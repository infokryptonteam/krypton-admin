import { failure, hasSameOrigin, success } from '../../_lib/http.js';
import { revokeSession } from '../../_lib/security.js';

export async function onRequestPost({ request, env }) {
  if (!hasSameOrigin(request)) return failure('Invalid request origin.', 403);
  const cookie = await revokeSession(request, env.DB);
  return success({ success: true }, 200, { 'Set-Cookie': cookie });
}
