import { failure, hasSameOrigin, readJson, success } from '../../_lib/http.js';
import { createSession, constantTimeEqual, hashPassword, sha256 } from '../../_lib/security.js';

const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;
const LOCK_MS = 30 * 1000;
const DUMMY_SALT = 'AAAAAAAAAAAAAAAAAAAAAA';

export async function onRequestPost({ request, env }) {
  if (!hasSameOrigin(request)) return failure('Invalid request origin.', 403);

  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return failure(error.message, 400);
  }
  const email = String(body?.email || '').trim().toLowerCase();
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length > 1024) {
    return failure('Invalid email or password.', 401);
  }

  const now = Date.now();
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const attemptKey = await sha256(`${ip}|${email}`);
  const prior = await env.DB.prepare('SELECT window_started_at, attempts, locked_until FROM login_attempts WHERE key_hash = ?')
    .bind(attemptKey).first();
  if (prior?.locked_until > now) return failure('Too many sign-in attempts. Try again shortly.', 429);

  const user = await env.DB.prepare('SELECT id, email, password_hash, password_salt FROM users WHERE email = ? COLLATE NOCASE').bind(email).first();
  const candidateHash = await hashPassword(password, user?.password_salt || DUMMY_SALT);
  const valid = Boolean(user && constantTimeEqual(candidateHash, user.password_hash));

  if (!valid) {
    const windowStartedAt = prior && now - prior.window_started_at < ATTEMPT_WINDOW_MS ? prior.window_started_at : now;
    const attempts = prior && windowStartedAt === prior.window_started_at ? prior.attempts + 1 : 1;
    const lockedUntil = attempts >= 5 ? now + LOCK_MS : 0;
    await env.DB.prepare(`
      INSERT INTO login_attempts (key_hash, window_started_at, attempts, locked_until) VALUES (?, ?, ?, ?)
      ON CONFLICT(key_hash) DO UPDATE SET window_started_at = excluded.window_started_at,
        attempts = excluded.attempts, locked_until = excluded.locked_until
    `).bind(attemptKey, windowStartedAt, attempts, lockedUntil).run();
    return failure('Invalid email or password.', 401);
  }

  await env.DB.prepare('DELETE FROM login_attempts WHERE key_hash = ?').bind(attemptKey).run();
  const cookie = await createSession(env.DB, request, user.id);
  return success({ success: true, email: user.email }, 200, { 'Set-Cookie': cookie });
}
