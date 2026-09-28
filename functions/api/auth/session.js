import { success } from '../../_lib/http.js';
import { getSessionUser } from '../../_lib/security.js';

export async function onRequestGet({ request, env }) {
  const user = await getSessionUser(request, env.DB);
  return success({ authenticated: Boolean(user), email: user?.email || '' });
}
