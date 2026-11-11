// Cliente HTTP de la API. En desarrollo Vite redirige /api/* al servidor Express.

export class ApiError extends Error {
  constructor(message, { status = null, detail = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail; // mensaje original del servidor (puede venir en español)
  }
}

// Mensajes de la UI (en inglés) según el código HTTP; el detalle del servidor se muestra aparte.
const STATUS_MESSAGES = {
  400: 'The request was not valid.',
  404: 'The requested session was not found.',
  429: 'The AI provider rate limit was reached. Please wait a moment and try again.',
  502: 'The AI provider returned an error.',
  503: 'The database is not available.',
  504: 'The AI provider took too long to respond.',
};

async function request(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Cannot reach the server. Make sure the API is running.');
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    let message = STATUS_MESSAGES[res.status] ?? `Unexpected server error (${res.status}).`;
    const retryAfter = Number(res.headers.get('Retry-After'));
    if (res.status === 429 && retryAfter > 0) {
      message = `The AI provider rate limit was reached. Try again in ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`;
    }
    throw new ApiError(message, { status: res.status, detail: data?.error ?? null });
  }
  return data;
}

export const getSessions = ({ signal } = {}) => request('/sessions', { signal });

export function getSessionMetrics(sessionId, { orderBy, order } = {}, { signal } = {}) {
  const params = new URLSearchParams();
  if (orderBy) params.set('order_by', orderBy);
  if (order) params.set('order', order);
  const qs = params.toString();
  return request(`/sessions/${sessionId}/metrics${qs ? `?${qs}` : ''}`, { signal });
}

export const generateReport = (sessionId, { language, audience }, { signal } = {}) =>
  request(`/sessions/${sessionId}/report`, { method: 'POST', body: { language, audience }, signal });
