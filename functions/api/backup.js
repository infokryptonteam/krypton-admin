import { failure, hasSameOrigin, success } from '../_lib/http.js';
import { readWorkspace } from '../_lib/records.js';
import { getSessionUser } from '../_lib/security.js';

export async function onRequestPost({ request, env }) {
  if (!hasSameOrigin(request)) return failure('Invalid request origin.', 403);
  const user = await getSessionUser(request, env.DB);
  if (!user) return failure('Not authenticated. Sign in again.', 401);
  try {
    const records = await readWorkspace(env.DB);
    return success({ createdAt: new Date().toISOString(), records });
  } catch (error) {
    console.error('Backup generation failed:', error);
    return failure('Could not create workspace backup.', 500);
  }
}
