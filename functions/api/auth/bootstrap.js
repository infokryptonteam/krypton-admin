import { failure, hasSameOrigin, readJson, success } from '../../_lib/http.js';
import { constantTimeEqual, hashPassword, newSalt } from '../../_lib/security.js';

export async function onRequestPost({ request, env }) {
  if (!env.BOOTSTRAP_SECRET) return failure('Admin setup is disabled.', 404);
  if (!hasSameOrigin(request)) return failure('Invalid request origin.', 403);
  const suppliedSecret = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!constantTimeEqual(suppliedSecret, env.BOOTSTRAP_SECRET)) return failure('Not authorized.', 401);

  const existing = await env.DB.prepare('SELECT id FROM users LIMIT 1').first();
  if (existing) return failure('Admin setup has already been completed.', 409);

  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return failure(error.message, 400);
  }
  const email = String(body?.email || '').trim().toLowerCase();
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return failure('Enter a valid admin email address.', 400);
  if (password.length < 12 || password.length > 1024) return failure('Use an admin password between 12 and 1024 characters.', 400);

  const salt = newSalt();
  const passwordHash = await hashPassword(password, salt);
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO users (id, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, email, passwordHash, salt, Date.now()).run();
  return success({ email }, 201);
}
