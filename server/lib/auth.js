import * as defaultFileSystem from 'node:fs/promises';
import { randomUUID, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'xingyu_admin';
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: false,
  path: '/',
  maxAge: 8 * 60 * 60 * 1000,
};
const LOGIN_ERROR = { error: '账号或密码错误' };
const SESSION_ERROR = { error: '请先登录' };

function parseCookies(header = '') {
  const cookies = {};
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex);
    const value = trimmed.slice(separatorIndex + 1);
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }
  return cookies;
}

function createCredentialError(credentialsPath) {
  return new Error(
    `缺少或无法读取管理员凭据文件: ${credentialsPath}。请参考 server/config/admin.example.json 创建 server/config/admin.local.json，并填写本地账号密码。`,
  );
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ''));
  const rightBuffer = Buffer.from(String(right ?? ''));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function createAuth({ credentialsPath, fileSystem: providedFileSystem = {} }) {
  const fileSystem = { ...defaultFileSystem, ...providedFileSystem };
  let credentials;

  try {
    credentials = JSON.parse(await fileSystem.readFile(credentialsPath, 'utf8'));
  } catch {
    throw createCredentialError(credentialsPath);
  }

  if (
    !credentials ||
    typeof credentials !== 'object' ||
    Array.isArray(credentials) ||
    typeof credentials.username !== 'string' ||
    credentials.username.trim() === '' ||
    typeof credentials.password !== 'string' ||
    credentials.password.trim() === ''
  ) {
    throw createCredentialError(credentialsPath);
  }

  const sessions = new Map();

  const readToken = (request) => parseCookies(request.headers.cookie)[COOKIE_NAME];

  return {
    cookieName: COOKIE_NAME,
    cookieOptions: COOKIE_OPTIONS,
    login(username, password) {
      if (
        !safeCompare(username, credentials.username) ||
        !safeCompare(password, credentials.password)
      ) {
        return null;
      }

      const token = randomUUID();
      sessions.set(token, { username: credentials.username });
      return token;
    },
    logout(request, _response, next) {
      const token = readToken(request);
      if (token) sessions.delete(token);
      request.authSessionToken = null;
      if (next) next();
    },
    requireSession(request, response, next) {
      const token = readToken(request);
      if (!token || !sessions.has(token)) {
        response.status(401).json(SESSION_ERROR);
        return;
      }

      request.authSessionToken = token;
      request.authUsername = sessions.get(token).username;
      next();
    },
    loginError: LOGIN_ERROR,
  };
}
