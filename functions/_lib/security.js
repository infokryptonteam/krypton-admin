const SESSION_COOKIE = 'krypton_session';
const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
const PASSWORD_ITERATIONS = 310000;
const encoder = new TextEncoder();

export function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(base64), character => character.charCodeAt(0));
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: fromBase64Url(salt), iterations: PASSWORD_ITERATIONS, hash: 'SHA-256' }, key, 256);
  return base64Url(new Uint8Array(bits));
}

export function constantTimeEqual(left, right) {
  const a = encoder.encode(String(left));
  const b = encoder.encode(String(right));
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) difference |= (a[index] || 0) ^ (b[index] || 0);
  return difference === 0;
}

export function newSalt() {
  return base64Url(crypto.getRandomValues(new Uint8Array(16)));
}

function getCookie(request, name) {
  const cookies = request.headers.get('Cookie') || '';
  for (const item of cookies.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() === name) return item.slice(separator + 1).trim();
  }
  return '';
}

function sessionCookie(request, value, maxAge) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie(request) {
  return sessionCookie(request, '', 0);
}

export async function createSession(db, request, userId) {
  const token = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const expiresAt = Date.now() + SESSION_LIFETIME_MS;
  await db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(tokenHash, userId, expiresAt).run();
  return sessionCookie(request, token, Math.floor(SESSION_LIFETIME_MS / 1000));
}

export async function getSessionUser(request, db) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = Date.now();
  const user = await db.prepare(`
    SELECT users.id, users.email
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).bind(tokenHash, now).first();
  if (!user) await db.prepare('DELETE FROM sessions WHERE token_hash = ? OR expires_at <= ?').bind(tokenHash, now).run();
  return user || null;
}

export async function revokeSession(request, db) {
  const token = getCookie(request, SESSION_COOKIE);
  if (token) await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  return clearSessionCookie(request);
}
