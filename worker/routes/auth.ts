import { Hono } from 'hono';
import type { Env } from '../env';
import {
  clearSessionCookie,
  clientIp,
  isHttps,
  randomToken,
  readCookie,
  safeEqual,
  sessionCookie,
  tokenHash,
} from '../lib/security';
import { TIMEZONE, todayInTimeZone } from '../lib/time';

export type AppEnv = { Bindings: Env };

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

function adminUsername(env: Env): string {
  return env.ADMIN_USERNAME?.trim() || 'Admin111';
}

function sessionTtlSeconds(env: Env): number {
  const hours = Number(env.SESSION_TTL_HOURS || '24');
  if (!Number.isFinite(hours) || hours <= 0) return 24 * 60 * 60;
  return Math.floor(hours * 60 * 60);
}

export function sessionPayload(env: Env) {
  return {
    username: adminUsername(env),
    today: todayInTimeZone(env.TIMEZONE || TIMEZONE),
    timezone: env.TIMEZONE || TIMEZONE,
    currency: env.CURRENCY || 'USD',
  };
}

export async function readAuth(env: Env, request: Request): Promise<boolean> {
  const secret = env.SESSION_SECRET;
  if (!secret) return false;
  const token = readCookie(request.headers.get('cookie') || undefined);
  if (!token) return false;
  const hash = await tokenHash(secret, token);
  const row = await env.DB.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?')
    .bind(hash)
    .first<{ expires_at: number }>();
  if (!row) return false;
  if (row.expires_at < Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(hash).run();
    return false;
  }
  return true;
}

export const authRoutes = new Hono<AppEnv>();

authRoutes.post('/login', async (c) => {
  const password = c.env.ADMIN_PASSWORD;
  const secret = c.env.SESSION_SECRET;
  if (!password || !secret) {
    return c.json({ error: 'Chưa cấu hình ADMIN_PASSWORD hoặc SESSION_SECRET trên Cloudflare' }, 503);
  }

  const body = await c.req.json().catch(() => null);
  const username = typeof body?.username === 'string' ? body.username : '';
  const givenPassword = typeof body?.password === 'string' ? body.password : '';
  if (!username || !givenPassword || username.length > 80 || givenPassword.length > 200) {
    return c.json({ error: 'Nhập tên đăng nhập và mật khẩu' }, 400);
  }

  const ip = clientIp(c.req.raw);
  const since = Date.now() - WINDOW_MS;
  const failures = await c.env.DB.prepare(
    'SELECT COUNT(*) AS total FROM login_attempts WHERE ip = ? AND created_at > ?',
  )
    .bind(ip, since)
    .first<{ total: number }>();
  if ((failures?.total ?? 0) >= MAX_FAILURES) {
    return c.json({ error: 'Đăng nhập sai quá nhiều lần. Thử lại sau 15 phút.' }, 429);
  }

  const [userOk, passOk] = await Promise.all([
    safeEqual(username, adminUsername(c.env)),
    safeEqual(givenPassword, password),
  ]);

  if (!userOk || !passOk) {
    await c.env.DB.prepare('INSERT INTO login_attempts (ip, username, created_at) VALUES (?, ?, ?)')
      .bind(ip, username.slice(0, 80), Date.now())
      .run();
    return c.json({ error: 'Sai tên đăng nhập hoặc mật khẩu' }, 401);
  }

  const token = randomToken();
  const hash = await tokenHash(secret, token);
  const now = Date.now();
  const ttl = sessionTtlSeconds(c.env);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
    c.env.DB.prepare('DELETE FROM login_attempts WHERE created_at < ?').bind(since),
    c.env.DB.prepare('INSERT INTO sessions (id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)').bind(
      crypto.randomUUID(),
      hash,
      now + ttl * 1000,
      now,
    ),
  ]);

  c.header('Set-Cookie', sessionCookie(token, ttl, isHttps(c.req.url)));
  return c.json(sessionPayload(c.env));
});

authRoutes.post('/logout', async (c) => {
  const secret = c.env.SESSION_SECRET;
  const token = readCookie(c.req.header('cookie'));
  if (secret && token) {
    const hash = await tokenHash(secret, token);
    await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(hash).run();
  }
  c.header('Set-Cookie', clearSessionCookie(isHttps(c.req.url)));
  return c.json({ ok: true });
});

authRoutes.get('/me', async (c) => {
  if (!(await readAuth(c.env, c.req.raw))) {
    return c.json({ error: 'Chưa đăng nhập' }, 401);
  }
  return c.json(sessionPayload(c.env));
});
