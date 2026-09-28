export function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export function success(data, status = 200, headers = {}) {
  return jsonResponse({ success: true, data }, status, headers);
}

export function failure(message, status = 400, headers = {}) {
  return jsonResponse({ success: false, message }, status, headers);
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}

export function hasSameOrigin(request) {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}

export function errorResponse(error, fallback = 'Request failed.') {
  const message = error instanceof Error ? error.message : fallback;
  return failure(message, error?.status || 400);
}
