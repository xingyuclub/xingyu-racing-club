import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import * as fileSystem from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, basename, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConfigStore } from './lib/configStore.js';
import { createAuth } from './lib/auth.js';
import { hydrateSiteData } from '../src/data/siteConfig.js';
import { createScoreRecognitionRouter } from './lib/scoreRecognitionRoutes.js';
import OpenAI from 'openai';

const currentFilePath = fileURLToPath(import.meta.url);
const defaultRootDir = resolve(dirname(currentFilePath), '..');
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const allowedUploads = [
  { mime: 'image/jpeg', ext: '.jpg', type: 'image' },
  { mime: 'image/jpeg', ext: '.jpeg', type: 'image' },
  { mime: 'image/png', ext: '.png', type: 'image' },
  { mime: 'image/webp', ext: '.webp', type: 'image' },
  { mime: 'image/gif', ext: '.gif', type: 'image' },
  { mime: 'video/mp4', ext: '.mp4', type: 'video' },
  { mime: 'video/webm', ext: '.webm', type: 'video' },
  { mime: 'audio/mpeg', ext: '.mp3', type: 'audio' },
  { mime: 'audio/mp4', ext: '.m4a', type: 'audio' },
  { mime: 'audio/ogg', ext: '.ogg', type: 'audio' },
  { mime: 'audio/wav', ext: '.wav', type: 'audio' },
];
const allowedUploadByPair = new Map(
  allowedUploads.map((item) => [`${item.mime}::${item.ext}`, item]),
);
const allowedUploadByExtension = new Map(allowedUploads.map((item) => [item.ext, item]));

function createRequestError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function getUploadDefinition(mime, originalName) {
  const extension = extname(originalName).toLowerCase();
  return allowedUploadByPair.get(`${mime}::${extension}`) ?? null;
}

function decodeOriginalName(originalName) {
  const value = String(originalName || '');
  const decoded = Buffer.from(value, 'latin1').toString('utf8');
  return decoded.includes('\ufffd') ? value : decoded;
}

function safeOriginalBasename(originalName) {
  const normalizedName = decodeOriginalName(originalName).replaceAll('\\', '/');
  const name = basename(normalizedName);
  const extension = extname(name).toLowerCase();
  const base = name
    .slice(0, name.length - extension.length)
    .replace(/[<>:"/|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 96);

  return base || 'file';
}

async function removeFileIfPresent(path) {
  try {
    await fileSystem.rm(path, { force: true });
  } catch {
    // Ignore cleanup failures and preserve the original request error.
  }
}

export async function createApp(options = {}) {
  const rootDir = options.rootDir ?? defaultRootDir;
  const dataDir = options.dataDir ?? join(rootDir, 'server', 'data');
  const uploadDir = options.uploadDir ?? join(rootDir, 'server', 'storage', 'uploads');
  const credentialsPath =
    options.credentialsPath ?? join(rootDir, 'server', 'config', 'admin.local.json');
  const distDir = options.distDir ?? join(rootDir, 'dist');
  const dev = Boolean(options.dev);

  await fileSystem.mkdir(uploadDir, { recursive: true });

  const auth = await createAuth({ credentialsPath });
  const store = await createConfigStore({ dataDir });

  const scoreRecognitionDataDir = options.scoreRecognitionDataDir ?? join(dataDir, 'score-recognition');
  const scoreRecognitionStorageDir = options.scoreRecognitionStorageDir ?? join(rootDir, 'server', 'storage', 'score-recognition');
  const sseConnections = new Set();
  const notifyConfigUpdate = () => {
    const version = String(Date.now());
    for (const res of sseConnections) {
      res.write('event: config-updated\n');
      res.write('data: ' + JSON.stringify({ version }) + '\n\n');
    }
  };
  const aiClient = options.aiClient ?? (process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null);
  const scoreRecognitionRouter = createScoreRecognitionRouter({
    configStore: store,
    dataDir: scoreRecognitionDataDir,
    storageDir: scoreRecognitionStorageDir,
    aiClient,
    model: process.env.OPENAI_VISION_MODEL || 'gpt-4o',
    onConfigUpdate: notifyConfigUpdate,
  });
  const resolvedUploadDir = resolve(uploadDir);
  const fallbackIndexPath = join(distDir, 'index.html');

  const listUploadFiles = async () => {
    const entries = await fileSystem.readdir(uploadDir, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => {
          const upload = allowedUploadByExtension.get(extname(entry.name).toLowerCase());
          if (!upload) return null;

          const info = await fileSystem.stat(join(uploadDir, entry.name));
          return {
            name: entry.name,
            path: `/uploads/${entry.name}`,
            type: upload.type,
            size: info.size,
          };
        }),
    );

    return files
      .filter(Boolean)
      .sort((left, right) => left.name.localeCompare(right.name));
  };

  const resolveUploadPath = (name) => {
    if (
      typeof name !== 'string' ||
      name.length === 0 ||
      name !== basename(name) ||
      name.includes('/') ||
      name.includes('\\')
    ) {
      throw createRequestError('文件名不合法');
    }

    const targetPath = resolve(uploadDir, name);
    if (!targetPath.startsWith(`${resolvedUploadDir}${sep}`)) {
      throw createRequestError('文件名不合法');
    }

    return targetPath;
  };

  const upload = multer({
    storage: multer.diskStorage({
      destination(_request, _file, callback) {
        callback(null, uploadDir);
      },
      filename(_request, file, callback) {
        const extension = extname(file.originalname);
        callback(null, `${randomUUID()}--${safeOriginalBasename(file.originalname)}${extension}`);
      },
    }),
    limits: {
      fileSize: MAX_UPLOAD_BYTES,
      files: 1,
    },
    fileFilter(request, file, callback) {
      const uploadDefinition = getUploadDefinition(file.mimetype, file.originalname);
      if (!uploadDefinition) {
        callback(createRequestError('仅支持指定格式的图片、视频或音频文件'));
        return;
      }

      request.uploadType = uploadDefinition.type;
      callback(null, true);
    },
  });

  const app = express();
  app.locals.listUploadFiles = listUploadFiles;

  app.use(express.json({ limit: '5mb' }));
  app.use('/uploads', express.static(uploadDir));
  app.use('/uploads', (_request, response) => {
    response.sendStatus(404);
  });

  app.get('/api/config', async (request, response, next) => {
    try {
      response.json(hydrateSiteData(await store.read()));
    } catch (error) {
      next(error);
    }
  });

  // 公网部署时屏蔽后台：通过 Host 头判断来源
  // 本地(127.0.0.1/localhost)和局域网(192.168.*/10.*/172.*)可访问后台
  // 来自公网穿透域名的请求一律拒绝 /api/login 与 /api/admin
  const isLocalHost = (host) => {
    if (!host) return false;
    const h = host.split(':')[0].toLowerCase();
    return h === '127.0.0.1' || h === 'localhost' || h === '0.0.0.0' ||
      h.startsWith('192.168.') || h.startsWith('10.') || h.startsWith('172.');
  };
  const isFromTunnel = (request) => !isLocalHost(request.headers.host);
  const blockTunnelAccess = (request, response, next) => {
    if (isFromTunnel(request)) {
      response.status(404).json({ error: 'Not Found' });
      return;
    }
    next();
  };
  app.use('/api/login', blockTunnelAccess);
  app.use('/api/admin', blockTunnelAccess);

  app.post('/api/login', (request, response) => {
    const token = auth.login(request.body?.username, request.body?.password);
    if (!token) {
      response.status(401).json(auth.loginError);
      return;
    }

    response.cookie(auth.cookieName, token, auth.cookieOptions);
    response.status(204).end();
  });

  app.post('/api/logout', auth.logout, (_request, response) => {
    response.clearCookie(auth.cookieName, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    });
    response.status(204).end();
  });

  app.get('/api/config/events', (request, response) => {
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders();
    sseConnections.add(response);
    request.on('close', () => sseConnections.delete(response));
  });

  app.use('/api/admin', auth.requireSession);
  app.use('/api/admin/score-recognition', scoreRecognitionRouter);

  app.get('/api/admin/config', async (_request, response, next) => {
    try {
      response.json(await store.read());
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/admin/config', async (request, response, next) => {
    try {
      await store.write(request.body);
      notifyConfigUpdate();
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/admin/upload', (request, response, next) => {
    upload.single('file')(request, response, async (error) => {
      if (error) {
        next(error);
        return;
      }

      try {
        if (!request.file) {
          throw createRequestError('请上传一个文件');
        }

        if (request.uploadType === 'image' && request.file.size > MAX_IMAGE_BYTES) {
          await removeFileIfPresent(request.file.path);
          throw createRequestError('图片大小不能超过 10MB');
        }

        response.status(201).json({
          name: request.file.filename,
          path: `/uploads/${request.file.filename}`,
          type: request.uploadType,
          size: request.file.size,
        });
      } catch (nextError) {
        next(nextError);
      }
    });
  });

  app.get('/api/admin/uploads', async (_request, response, next) => {
    try {
      response.json(await listUploadFiles());
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/admin/uploads/:name', async (request, response, next) => {
    try {
      const targetPath = resolveUploadPath(request.params.name);
      await fileSystem.rm(targetPath);
      response.status(204).end();
    } catch (error) {
      if (error.code === 'ENOENT') {
        response.status(404).json({ error: '文件不存在' });
        return;
      }
      next(error);
    }
  });

  app.use('/api', (_request, response) => {
    response.status(404).json({ error: '接口不存在' });
  });

  if (!dev) {
    app.use(express.static(distDir));
    app.get(/^(?!\/api(?:\/|$))(?!\/uploads(?:\/|$)).*/, async (_request, response, next) => {
      try {
        await fileSystem.access(fallbackIndexPath);
        response.sendFile(fallbackIndexPath);
      } catch (error) {
        if (error.code === 'ENOENT') {
          next();
          return;
        }
        next(error);
      }
    });
  }

  app.use((error, _request, response, _next) => {
    if (error?.code === 'INVALID_CONFIG') {
      response.status(400).json({
        error: '配置校验失败',
        details: Array.isArray(error.details) ? error.details : [],
      });
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        response.status(400).json({ error: '上传文件不能超过 200MB' });
        return;
      }

      response.status(400).json({ error: '上传文件不符合要求' });
      return;
    }

    if (error?.statusCode === 400) {
      response.status(400).json({ error: error.message });
      return;
    }

    response.status(500).json({ error: '服务器内部错误' });
  });

  app.use((_request, response) => {
    response.sendStatus(404);
  });

  return app;
}

if (process.argv[1] && resolve(process.argv[1]) === currentFilePath) {
  const app = await createApp({ dev: process.argv.includes('--dev') });
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  const host = process.env.HOST || '127.0.0.1';

  app.listen(port, host, () => {
    console.log(`http://${host}:${port}`);
  });
}
