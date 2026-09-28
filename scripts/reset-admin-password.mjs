import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const email = (process.env.KRYPTON_RESET_EMAIL || '').trim().toLowerCase();
const password = process.env.KRYPTON_RESET_PASSWORD || '';

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Set KRYPTON_RESET_EMAIL to the existing admin email.');
  process.exit(1);
}

if (password.length < 12 || password.length > 1024) {
  console.error('Set a new password between 12 and 1024 characters.');
  process.exit(1);
}

const saltBytes = randomBytes(16);
const salt = saltBytes.toString('base64url');
const passwordHash = pbkdf2Sync(password, saltBytes, 100000, 32, 'sha256').toString('base64url');
const escapedEmail = email.replace(/'/g, "''");
const sql = `UPDATE users SET password_hash = '${passwordHash}', password_salt = '${salt}' WHERE lower(email) = lower('${escapedEmail}') RETURNING email;\nDELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE lower(email) = lower('${escapedEmail}'));\n`;

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'krypton-admin-reset-'));
const sqlFile = join(temporaryDirectory, 'reset-password.sql');
const wranglerCli = join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', 'wrangler', 'bin', 'wrangler.js');

try {
  writeFileSync(sqlFile, sql, { encoding: 'utf8', mode: 0o600 });
  const result = spawnSync(process.execPath, [wranglerCli, 'd1', 'execute', 'krypton-manage-db', '--remote', '--file', sqlFile], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status || 1;
  else console.log('Password reset SQL completed. Confirm one matching email was returned above.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Password reset failed.');
  process.exitCode = 1;
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}