import { failure, hasSameOrigin, readJson, success } from '../../_lib/http.js';
import { entityDefinitions, saveEntity } from '../../_lib/records.js';
import { getSessionUser } from '../../_lib/security.js';

export async function onRequestPost({ request, env, params }) {
  if (!hasSameOrigin(request)) return failure('Invalid request origin.', 403);
  const user = await getSessionUser(request, env.DB);
  if (!user) return failure('Not authenticated. Sign in again.', 401);
  const entity = String(params.entity || '').toLowerCase();
  if (!entityDefinitions[entity]) return failure('Unsupported record type.', 404);
  let body;
  try {
    body = await readJson(request);
    const record = await saveEntity(env.DB, entity, body?.data);
    return success(record, 201);
  } catch (error) {
    return failure(error.message || 'Could not save record.', 400);
  }
}
