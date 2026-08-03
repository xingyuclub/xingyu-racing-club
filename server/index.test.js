// @vitest-environment node

import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './index.js';

const binaryParser = (response, callback) => {
  const chunks = [];
  response.on('data', (chunk) => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
};

async function createFixture({ dev = true, withCredentials = true, distIndex = '<!doctype html><html><body>admin</body></html>' } = {}) {
  const rootDir = await mkdtemp(join(tmpdir(), 'config-admin-api-'));
  const dataDir = join(rootDir, 'server', 'data');
  const uploadDir = join(rootDir, 'server', 'storage', 'uploads');
  const distDir = join(rootDir, 'dist');
  const credentialsPath = join(rootDir, 'server', 'config', 'admin.local.json');

  await mkdir(dataDir, { recursive: true });
  await mkdir(uploadDir, { recursive: true });
  await mkdir(distDir, { recursive: true });
  await writeFile(join(distDir, 'index.html'), distIndex);

  if (withCredentials) {
    await mkdir(dirname(credentialsPath), { recursive: true });
    await writeFile(
      credentialsPath,
      `${JSON.stringify({ username: 'admin', password: 'test-password' }, null, 2)}\n`,
    );
  }

  const app = await createApp({
    rootDir,
    dataDir,
    uploadDir,
    credentialsPath,
    distDir,
    dev,
  });

  return { app, rootDir, dataDir, uploadDir, credentialsPath, distDir };
}

async function loginAsAdmin(app) {
  const agent = request.agent(app);
  const response = await agent
    .post('/api/login')
    .send({ username: 'admin', password: 'test-password' })
    .expect(204);

  return { agent, response };
}

describe('config admin API', () => {
  const tempRoots = [];

  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((rootDir) => rm(rootDir, { recursive: true, force: true })));
  });

  it('returns public config and blocks unauthenticated admin config access', async () => {
    const fixture = await createFixture();
    tempRoots.push(fixture.rootDir);

    const publicResponse = await request(fixture.app).get('/api/config').expect(200);
    expect(publicResponse.body).toEqual(
      expect.objectContaining({
        team: expect.any(Object),
        gallery: expect.any(Array),
        leaderboard: expect.any(Array),
      }),
    );

    await request(fixture.app)
      .get('/api/admin/config')
      .expect(401)
      .expect('Content-Type', /json/);
  });

  it('accepts valid login, rejects invalid login with a generic error, and revokes the session on logout', async () => {
    const fixture = await createFixture();
    tempRoots.push(fixture.rootDir);

    const invalidUser = await request(fixture.app)
      .post('/api/login')
      .send({ username: 'wrong', password: 'test-password' })
      .expect(401);
    const invalidPassword = await request(fixture.app)
      .post('/api/login')
      .send({ username: 'admin', password: 'wrong' })
      .expect(401);

    expect(invalidUser.body).toEqual(invalidPassword.body);

    const { agent, response } = await loginAsAdmin(fixture.app);
    const cookieHeader = response.headers['set-cookie']?.[0] ?? '';
    expect(cookieHeader).toMatch(/^xingyu_admin=/);
    expect(cookieHeader).toContain('HttpOnly');
    expect(cookieHeader).toContain('SameSite=Lax');
    expect(cookieHeader).toContain('Path=/');
    expect(cookieHeader).toContain('Max-Age=28800');
    expect(cookieHeader).not.toContain('Secure');

    await agent.get('/api/admin/config').expect(200);
    await agent.post('/api/logout').expect(204);
    await agent.get('/api/admin/config').expect(401);
  });

  it('invalidates in-memory sessions when the server restarts', async () => {
    const fixture = await createFixture();
    tempRoots.push(fixture.rootDir);

    const { response } = await loginAsAdmin(fixture.app);
    const cookieHeader = response.headers['set-cookie']?.[0];
    const restarted = await createApp({
      rootDir: fixture.rootDir,
      dataDir: fixture.dataDir,
      uploadDir: fixture.uploadDir,
      credentialsPath: fixture.credentialsPath,
      distDir: fixture.distDir,
      dev: true,
    });

    await request(restarted)
      .get('/api/admin/config')
      .set('Cookie', cookieHeader)
      .expect(401);
  });

  it('lets an authenticated session read and update raw config while public config stays hydrated', async () => {
    const fixture = await createFixture();
    tempRoots.push(fixture.rootDir);
    const { agent } = await loginAsAdmin(fixture.app);

    const configResponse = await agent.get('/api/admin/config').expect(200);
    const nextConfig = structuredClone(configResponse.body);
    nextConfig.team.motto = '已保存';
    nextConfig.scoreMembers[0].basePoints = 999;
    nextConfig.roster[0].wins = 5;

    await agent.put('/api/admin/config').send(nextConfig).expect(204);

    const publicResponse = await request(fixture.app).get('/api/config').expect(200);
    expect(publicResponse.body.team.motto).toBe('已保存');
    expect(publicResponse.body.leaderboard[0]).toMatchObject({
      id: nextConfig.scoreMembers[0].id,
      rank: 1,
      // 排行榜显示最新日期所在周的“总分”，每周从零开始。
      points: 98,
    });
  });

  it('returns validation details when the admin config payload is invalid', async () => {
    const fixture = await createFixture();
    tempRoots.push(fixture.rootDir);
    const { agent } = await loginAsAdmin(fixture.app);
    const configResponse = await agent.get('/api/admin/config').expect(200);
    const invalidConfig = structuredClone(configResponse.body);
    invalidConfig.team.motto = '';

    const response = await agent.put('/api/admin/config').send(invalidConfig).expect(400);
    expect(response.body).toEqual({
      error: '配置校验失败',
      details: expect.arrayContaining(['team.motto must be a non-empty string']),
    });
  });

  it('uploads an allowed png, returns a random stored path, and serves the stored bytes from /uploads', async () => {
    const fixture = await createFixture();
    tempRoots.push(fixture.rootDir);
    const { agent } = await loginAsAdmin(fixture.app);
    const fileBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

    const response = await agent
      .post('/api/admin/upload')
      .attach('file', fileBytes, {
        filename: 'avatar.PNG',
        contentType: 'image/png',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      type: 'image',
      size: fileBytes.length,
    });
    expect(response.body.name).toMatch(/^[0-9a-f-]{36}--avatar\.PNG$/);
    expect(response.body.path).toBe(`/uploads/${response.body.name}`);

    const stored = await request(fixture.app)
      .get(response.body.path)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);
    expect(stored.body).toEqual(fileBytes);
  });

  it('preserves unicode characters in the uploaded original filename', async () => {
    const fixture = await createFixture();
    tempRoots.push(fixture.rootDir);
    const { agent } = await loginAsAdmin(fixture.app);

    const response = await agent
      .post('/api/admin/upload')
      .attach('file', Buffer.from([0xff, 0xd8, 0xff]), {
        filename: '青山头像.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);

    expect(response.body.name).toMatch(/^[0-9a-f-]{36}--青山头像\.jpg$/);
  });

  it('strips path separators and reserved characters from the original filename', async () => {
    const fixture = await createFixture();
    tempRoots.push(fixture.rootDir);
    const { agent } = await loginAsAdmin(fixture.app);

    const response = await agent
      .post('/api/admin/upload')
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: 'C:\\Users\\test\\my<avatar>.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(response.body.name).not.toMatch(/[\\/:<>|?*]/);
    expect(response.body.name).toMatch(/^([0-9a-f-]{36})--my_avatar_\.png$/);
    expect(response.body.name).not.toContain('Users');
  });

  it('does not overwrite an earlier file that had the same original name', async () => {
    const fixture = await createFixture();
    tempRoots.push(fixture.rootDir);
    const { agent } = await loginAsAdmin(fixture.app);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

    const first = await agent
      .post('/api/admin/upload')
      .attach('file', png, { filename: 'avatar.png', contentType: 'image/png' })
      .expect(201);
    const second = await agent
      .post('/api/admin/upload')
      .attach('file', png, { filename: 'avatar.png', contentType: 'image/png' })
      .expect(201);

    expect(first.body.name).not.toBe(second.body.name);
    expect(first.body.name).toMatch(/avatar\.png$/);
    expect(second.body.name).toMatch(/avatar\.png$/);
  });

  it('falls back to the generic name when the original cleans to empty', async () => {
    const fixture = await createFixture();
    tempRoots.push(fixture.rootDir);
    const { agent } = await loginAsAdmin(fixture.app);

    const response = await agent
      .post('/api/admin/upload')
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: '..png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(response.body.name).toMatch(/^[0-9a-f-]{36}--file\.png$/);
  });

  it('rejects unsupported uploads and mismatched extension and mime pairs', async () => {
    const fixture = await createFixture();
    tempRoots.push(fixture.rootDir);
    const { agent } = await loginAsAdmin(fixture.app);

    await agent
      .post('/api/admin/upload')
      .attach('file', Buffer.from('plain text'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })
      .expect(400);

    await agent
      .post('/api/admin/upload')
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: 'avatar.png',
        contentType: 'image/jpeg',
      })
      .expect(400);
  });

  it('rejects an oversized image after upload and leaves no file behind', async () => {
    const fixture = await createFixture();
    tempRoots.push(fixture.rootDir);
    const { agent } = await loginAsAdmin(fixture.app);
    const largeImage = Buffer.alloc(10 * 1024 * 1024 + 1, 1);

    await agent
      .post('/api/admin/upload')
      .attach('file', largeImage, {
        filename: 'huge.png',
        contentType: 'image/png',
      })
      .expect(400);

    const entries = await fixture.app.locals.listUploadFiles();
    expect(entries).toEqual([]);
  });

  it('lists uploaded files in sorted order with derived media types', async () => {
    const fixture = await createFixture();
    tempRoots.push(fixture.rootDir);
    const { agent } = await loginAsAdmin(fixture.app);

    await agent
      .post('/api/admin/upload')
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: 'zeta.png',
        contentType: 'image/png',
      })
      .expect(201);
    await agent
      .post('/api/admin/upload')
      .attach('file', Buffer.from([0x52, 0x49, 0x46, 0x46]), {
        filename: 'alpha.wav',
        contentType: 'audio/wav',
      })
      .expect(201);

    const response = await agent.get('/api/admin/uploads').expect(200);
    const sortedNames = [...response.body.map((file) => file.name)].sort((left, right) =>
      left.localeCompare(right),
    );

    expect(response.body).toHaveLength(2);
    expect(response.body.map((file) => file.name)).toEqual(sortedNames);
    expect(response.body.map((file) => file.type).sort()).toEqual(['audio', 'image']);
    expect(response.body.every((file) => file.path === `/uploads/${file.name}`)).toBe(true);
  });

  it('deletes uploaded files and rejects missing or traversal targets', async () => {
    const fixture = await createFixture();
    tempRoots.push(fixture.rootDir);
    const { agent } = await loginAsAdmin(fixture.app);

    const upload = await agent
      .post('/api/admin/upload')
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(201);

    await agent.delete(`/api/admin/uploads/${encodeURIComponent(upload.body.name)}`).expect(204);
    await agent.delete(`/api/admin/uploads/${encodeURIComponent(upload.body.name)}`).expect(404);
    await agent.delete('/api/admin/uploads/..%5Csecret.txt').expect(400);
  });

  it('fails startup with an actionable missing credential error that names admin.example.json', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'config-admin-api-'));
    tempRoots.push(rootDir);

    await expect(
      createApp({
        rootDir,
        dataDir: join(rootDir, 'server', 'data'),
        uploadDir: join(rootDir, 'server', 'storage', 'uploads'),
        credentialsPath: join(rootDir, 'server', 'config', 'admin.local.json'),
        distDir: join(rootDir, 'dist'),
        dev: true,
      }),
    ).rejects.toThrow(/admin\.example\.json/);
  });

  it('serves the production dist index for / and /admin while api and upload misses remain non-html errors', async () => {
    const fixture = await createFixture({
      dev: false,
      distIndex: '<!doctype html><html><body>prod shell</body></html>',
    });
    tempRoots.push(fixture.rootDir);

    await request(fixture.app).get('/').expect(200).expect(/prod shell/);
    await request(fixture.app).get('/admin').expect(200).expect(/prod shell/);
    await request(fixture.app)
      .get('/api/missing')
      .expect(404)
      .expect('Content-Type', /json/);
    await request(fixture.app).get('/uploads/missing.png').expect(404);
  });

  it('rejects a missing upload file field', async () => {
    const fixture = await createFixture();
    tempRoots.push(fixture.rootDir);
    const { agent } = await loginAsAdmin(fixture.app);

    await agent.post('/api/admin/upload').expect(400);
  });

  it('persists uploads under the configured upload directory', async () => {
    const fixture = await createFixture();
    tempRoots.push(fixture.rootDir);
    const { agent } = await loginAsAdmin(fixture.app);

    const response = await agent
      .post('/api/admin/upload')
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(201);

    const storedPath = join(fixture.uploadDir, response.body.name);
    const info = await stat(storedPath);
    const storedBytes = await readFile(storedPath);

    expect(info.isFile()).toBe(true);
    expect(storedBytes).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });
});

describe('score recognition API', () => {
  const tempRoots = [];

  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((rootDir) => rm(rootDir, { recursive: true, force: true })));
  });

  function createFakeAiClient(matches) {
    return {
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: JSON.stringify({ matches }) } }],
          }),
        },
      },
    };
  }

  async function createRecognitionFixture({ aiClient } = {}) {
    const rootDir = await mkdtemp(join(tmpdir(), 'score-recog-api-'));
    tempRoots.push(rootDir);
    const dataDir = join(rootDir, 'server', 'data');
    const uploadDir = join(rootDir, 'server', 'storage', 'uploads');
    const distDir = join(rootDir, 'dist');
    const credentialsPath = join(rootDir, 'server', 'config', 'admin.local.json');
    await mkdir(dataDir, { recursive: true });
    await mkdir(uploadDir, { recursive: true });
    await mkdir(distDir, { recursive: true });
    await mkdir(dirname(credentialsPath), { recursive: true });
    await writeFile(credentialsPath, JSON.stringify({ username: 'admin', password: 'test-password' }) + '\n');

    const app = await createApp({ rootDir, dataDir, uploadDir, credentialsPath, distDir, dev: true, aiClient });
    return { app, rootDir };
  }

  const jpgBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

  it('rejects unauthenticated access to recognition endpoints', async () => {
    const { app } = await createRecognitionFixture();
    await request(app).get('/api/admin/score-recognition/batches').expect(401);
    await request(app).post('/api/admin/score-recognition/batches').expect(401);
  });

  it('uploads screenshots, processes them with AI, and commits the result', async () => {
    const matches = [{
      title: '队内赛',
      date: '2026-08-01',
      time: '10:00:00',
      participants: [{ nickname: '成员 01', rank: 1 }],
    }];
    const { app } = await createRecognitionFixture({ aiClient: createFakeAiClient(matches) });
    const { agent } = await loginAsAdmin(app);

    const upload = await agent
      .post('/api/admin/score-recognition/batches')
      .field('date', '2026-08-01')
      .attach('files', jpgBytes, { filename: 'shot.jpg', contentType: 'image/jpeg' })
      .expect(201);
    const batchId = upload.body.id;

    const draft = await agent.post('/api/admin/score-recognition/batches/' + batchId + '/process').expect(200);
    expect(draft.body.races).toHaveLength(1);
    expect(draft.body.races[0].type).toBe('team');

    const commit = await agent
      .post('/api/admin/score-recognition/batches/' + batchId + '/commit')
      .send({ rosterVersion: draft.body.rosterVersion })
      .expect(200);
    expect(commit.body.committed).toBe(true);
    expect(commit.body.config.dailyScores.find((r) => r.date === '2026-08-01')).toBeTruthy();
  });

  it('rejects unsupported screenshot file types', async () => {
    const { app } = await createRecognitionFixture();
    const { agent } = await loginAsAdmin(app);
    await agent
      .post('/api/admin/score-recognition/batches')
      .field('date', '2026-08-01')
      .attach('files', Buffer.from('not an image'), { filename: 'doc.txt', contentType: 'text/plain' })
      .expect(400);
  });

  it('requires a valid batch date', async () => {
    const { app } = await createRecognitionFixture();
    const { agent } = await loginAsAdmin(app);
    await agent
      .post('/api/admin/score-recognition/batches')
      .field('date', 'invalid')
      .expect(400);
  });

  it('lists and reads batches after creation', async () => {
    const { app } = await createRecognitionFixture();
    const { agent } = await loginAsAdmin(app);
    const created = await agent
      .post('/api/admin/score-recognition/batches')
      .field('date', '2026-08-01')
      .attach('files', jpgBytes, { filename: 'a.jpg', contentType: 'image/jpeg' })
      .expect(201);

    const list = await agent.get('/api/admin/score-recognition/batches').expect(200);
    expect(list.body).toHaveLength(1);

    const detail = await agent.get('/api/admin/score-recognition/batches/' + created.body.id).expect(200);
    expect(detail.body.id).toBe(created.body.id);
  });
});

describe('public tunnel admin block', () => {
  const tempRoots = [];

  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it('blocks /api/login and /api/admin when Host is a public tunnel domain', async () => {
    const fixture = await createFixture({ dev: true });
    tempRoots.push(fixture.rootDir);

    await request(fixture.app)
      .post('/api/login')
      .set('Host', 'abc123.r6.cpolar.cn')
      .send({ username: 'admin', password: 'test-password' })
      .expect(404);

    await request(fixture.app)
      .get('/api/admin/config')
      .set('Host', 'some-tunnel.trycloudflare.com')
      .expect(404);
  });

  it('still allows local access via 127.0.0.1 and localhost', async () => {
    const fixture = await createFixture({ dev: true });
    tempRoots.push(fixture.rootDir);

    await request(fixture.app)
      .post('/api/login')
      .send({ username: 'admin', password: 'wrong' })
      .expect(401);

    await request(fixture.app).get('/api/admin/config').expect(401);
  });

  it('keeps public API accessible even from a tunnel Host', async () => {
    const fixture = await createFixture({ dev: true });
    tempRoots.push(fixture.rootDir);

    await request(fixture.app).get('/api/config').set('Host', 'tunnel.cpolar.cn').expect(200);
  });
});
