import { failure } from '../_lib/http.js';

const MUTATING_API_PATHS = new Set([
  '/api/auth/login', '/api/auth/logout', '/api/auth/bootstrap', '/api/backup',
]);

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return context.next();
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return context.next();
  if (!['POST', 'PUT', 'DELETE'].includes(request.method)) return failure('Method not allowed.', 405);
  const isRecordRoute = /^\/api\/records\/[a-z]+(?:\/[^/]+)?$/.test(url.pathname);
  if (!MUTATING_API_PATHS.has(url.pathname) && !isRecordRoute) {
    return failure('Unsupported API route.', 404);
  }
  if (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) {
    return failure('Invalid request origin.', 403);
  }
  if (request.method !== 'DELETE' && !(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) {
    return failure('Unsupported content type.', 415);
  }
  return context.next();
}
