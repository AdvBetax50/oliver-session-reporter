import { describe, expect, test, vi } from 'vitest';
import { ApiError, generateReport, getSessionMetrics, getSessions } from './api.js';
import { jsonResponse } from './test/fixtures.js';

function stubFetch(impl) {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('api.js', () => {
  test('getSessions: GET /api/sessions y devuelve el JSON', async () => {
    const fetch = stubFetch(async () => jsonResponse([{ id: 1 }]));
    expect(await getSessions()).toEqual([{ id: 1 }]);
    expect(fetch).toHaveBeenCalledWith('/api/sessions', expect.objectContaining({ method: 'GET' }));
  });

  test('getSessionMetrics: arma la query string con order_by y order (snake_case de la API)', async () => {
    const fetch = stubFetch(async () => jsonResponse({}));
    await getSessionMetrics(103, { orderBy: 'workload_au', order: 'desc' });
    expect(fetch.mock.calls[0][0]).toBe('/api/sessions/103/metrics?order_by=workload_au&order=desc');
    await getSessionMetrics(103);
    expect(fetch.mock.calls[1][0]).toBe('/api/sessions/103/metrics');
  });

  test('generateReport: POST con language y audience en el body JSON', async () => {
    const fetch = stubFetch(async () => jsonResponse({ ok: true }));
    await generateReport(103, { language: 'es', audience: 'player' });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('/api/sessions/103/report');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ language: 'es', audience: 'player' });
  });

  test('pasa la señal de cancelación a fetch', async () => {
    const fetch = stubFetch(async () => jsonResponse([]));
    const controller = new AbortController();
    await getSessions({ signal: controller.signal });
    expect(fetch.mock.calls[0][1].signal).toBe(controller.signal);
  });

  test('error HTTP -> ApiError con mensaje en inglés por status y el detalle original del servidor', async () => {
    stubFetch(async () => jsonResponse({ error: 'La sesión 999 no existe' }, { status: 404 }));
    const err = await getSessionMetrics(999).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404, message: 'The requested session was not found.', detail: 'La sesión 999 no existe' });
  });

  test('429 con Retry-After -> indica cuántos segundos esperar', async () => {
    stubFetch(async () => jsonResponse({ error: 'quota' }, { status: 429, headers: { 'Retry-After': '42' } }));
    await expect(generateReport(1, { language: 'en', audience: 'coach' })).rejects.toThrow('Try again in 42 seconds.');
  });

  test('status sin mensaje conocido y cuerpo no JSON', async () => {
    stubFetch(async () => ({ ok: false, status: 418, headers: new Headers(), json: async () => { throw new Error('no json'); } }));
    await expect(getSessions()).rejects.toMatchObject({ message: 'Unexpected server error (418).', detail: null });
  });

  test('servidor inalcanzable -> mensaje claro; AbortError se propaga tal cual', async () => {
    stubFetch(async () => { throw new TypeError('Failed to fetch'); });
    await expect(getSessions()).rejects.toThrow('Cannot reach the server. Make sure the API is running.');

    stubFetch(async () => { throw new DOMException('aborted', 'AbortError'); });
    await expect(getSessions()).rejects.toMatchObject({ name: 'AbortError' });
  });
});
