import { failure, success } from '../_lib/http.js';
import { readWorkspace } from '../_lib/records.js';
import { getSessionUser } from '../_lib/security.js';

export async function onRequestGet({ request, env }) {
  const user = await getSessionUser(request, env.DB);
  if (!user) return failure('Not authenticated. Sign in again.', 401);
  try {
    return success(await readWorkspace(env.DB));
  } catch (error) {
    console.error('Could not read workspace data:', error);
    return failure('Could not load workspace data.', 500);
  }
}
