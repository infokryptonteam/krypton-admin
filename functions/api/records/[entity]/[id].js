import { failure, hasSameOrigin, readJson, success } from '../../../_lib/http.js';
import { deleteEntity, entityDefinitions, updateEntity } from '../../../_lib/records.js';
import { getSessionUser } from '../../../_lib/security.js';

async function requireAdmin(request, db) {
  if (!hasSameOrigin(request)) return failure('Invalid request origin.', 403);
  const user = await getSessionUser(request, db);
  return user ? null : failure('Not authenticated. Sign in again.', 401);
}

export async function onRequestPut({ request, env, params }) {
  const authFailure = await requireAdmin(request, env.DB);
  if (authFailure) return authFailure;
  const entity = String(params.entity || '').toLowerCase();
  const recordId = String(params.id || '');
  if (!entityDefinitions[entity]) return failure('Unsupported record type.', 404);
  try {
    const body = await readJson(request);
    return success(await updateEntity(env.DB, entity, recordId, body?.data));
  } catch (error) {
    return failure(error.message || 'Could not update record.', 400);
  }
}

export async function onRequestDelete({ request, env, params }) {
  const authFailure = await requireAdmin(request, env.DB);
  if (authFailure) return authFailure;
  const entity = String(params.entity || '').toLowerCase();
  const recordId = String(params.id || '');
  if (!entityDefinitions[entity]) return failure('Unsupported record type.', 404);
  try {
    return success(await deleteEntity(env.DB, entity, recordId));
  } catch (error) {
    return failure(error.message || 'Could not delete record.', 400);
  }
}
