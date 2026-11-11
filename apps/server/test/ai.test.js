import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAiProvider, AiProviderError, generateWithRetry } from '../src/ai/index.js';
import { GeminiProvider, parseRetryAfterMs, toGeminiSchema } from '../src/ai/providers/gemini.provider.js';

const common = { model: 'gemini-test', temperature: 0.4, maxOutputTokens: 256, timeoutMs: 1000 };

function fakeFetch(status, payload, calls = [], headers = {}) {
  return async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (name) => headers[name.toLowerCase()] ?? null },
      json: async () => payload,
    };
  };
}
const gemini = (fetchImpl) => new GeminiProvider({ ...common, apiKey: 'k', baseUrl: 'https://x', fetchImpl });

test('la factoría elige el proveedor según AI_PROVIDER', () => {
  assert.equal(createAiProvider({ AI_PROVIDER: 'mock' }).name, 'mock');
  const provider = createAiProvider({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', AI_TEMPERATURE: '0.1' });
  assert.equal(provider.name, 'gemini');
  assert.equal(provider.model, 'gemini-3.1-flash-lite');
  assert.equal(provider.temperature, 0.1);
  assert.equal(provider.maxOutputTokens, 4096);
});

test('proveedor desconocido o sin API key falla con un error claro', () => {
  assert.throws(() => createAiProvider({ AI_PROVIDER: 'nope' }), /no soportado/);
  assert.throws(() => createAiProvider({ AI_PROVIDER: 'gemini' }), (e) => /GEMINI_API_KEY/.test(e.message) && e.code === 'config');
});

test('el mock responde sin red', async () => {
  const res = await createAiProvider({ AI_PROVIDER: 'mock' }).generate({ prompt: 'hola' });
  assert.equal(res.provider, 'mock');
  assert.match(res.text, /mock/);
});

test('Gemini: arma la petición (schema, system, key en cabecera) y normaliza la respuesta', async () => {
  const calls = [];
  const provider = new GeminiProvider({
    ...common, apiKey: 'secret', baseUrl: 'https://example.test/v1beta/',
    fetchImpl: fakeFetch(200, {
      candidates: [{ content: { parts: [{ text: 'Hola ' }, { text: 'coach' }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 3 },
      modelVersion: 'gemini-test-001',
    }, calls),
  });
  const schema = { type: 'object', properties: { summary: { type: 'string' }, ids: { type: 'array', items: { type: 'string', enum: ['1'] } } }, required: ['summary'] };

  const res = await provider.generate({ prompt: 'datos', system: 'eres analista', schema });

  assert.deepEqual(res, {
    text: 'Hola coach', provider: 'gemini', model: 'gemini-test-001', finishReason: 'STOP', usage: { inputTokens: 12, outputTokens: 3 },
  });
  assert.equal(calls[0].url, 'https://example.test/v1beta/models/gemini-test:generateContent');
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'secret');
  assert.ok(!calls[0].url.includes('secret'), 'la API key no debe ir en la URL');
  assert.equal(calls[0].body.systemInstruction.parts[0].text, 'eres analista');
  assert.equal(calls[0].body.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(calls[0].body.generationConfig.responseSchema, toGeminiSchema(schema));
  assert.equal(calls[0].body.generationConfig.maxOutputTokens, 256);
});

test('toGeminiSchema: tipos en mayúsculas, enum y orden de propiedades', () => {
  const out = toGeminiSchema({ type: 'object', properties: { b: { type: 'string', enum: ['x'] }, a: { type: 'array', minItems: 2, items: { type: 'number' } } } });
  assert.deepEqual(out, {
    type: 'OBJECT',
    properties: { b: { type: 'STRING', enum: ['x'] }, a: { type: 'ARRAY', minItems: 2, items: { type: 'NUMBER' } } },
    propertyOrdering: ['b', 'a'],
  });
});

test('Gemini: errores normalizados (rate limit, 5xx, auth, bloqueo, timeout, red)', async () => {
  const is = (code, status) => (e) => e instanceof AiProviderError && e.code === code && e.status === status;

  // 429 con RetryInfo de Google
  const quota = { error: { message: 'quota', details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '17s' }] } };
  await assert.rejects(gemini(fakeFetch(429, quota)).generate({ prompt: 'x' }), (e) => is('rate_limit', 429)(e) && e.retryAfterMs === 17000 && e.retryable);
  await assert.rejects(gemini(fakeFetch(503, { error: { message: 'overloaded' } })).generate({ prompt: 'x' }), (e) => is('unavailable', 502)(e) && e.retryable);
  await assert.rejects(gemini(fakeFetch(403, { error: { message: 'API key not valid' } })).generate({ prompt: 'x' }), (e) => is('auth', 502)(e) && !e.retryable);
  await assert.rejects(gemini(fakeFetch(200, { promptFeedback: { blockReason: 'SAFETY' } })).generate({ prompt: 'x' }), (e) => is('invalid_response', 502)(e) && /SAFETY/.test(e.message));

  const timeoutFetch = async () => { throw Object.assign(new Error('aborted'), { name: 'TimeoutError' }); };
  await assert.rejects(gemini(timeoutFetch).generate({ prompt: 'x' }), (e) => is('timeout', 504)(e) && !e.retryable);
  const networkFetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(gemini(networkFetch).generate({ prompt: 'x' }), (e) => is('network', 502)(e) && e.retryable);
});

test('parseRetryAfterMs: cabecera Retry-After o RetryInfo', () => {
  assert.equal(parseRetryAfterMs({ headers: { get: () => '3' } }, {}), 3000);
  assert.equal(parseRetryAfterMs({ headers: { get: () => null } }, { error: { details: [{ '@type': 'x.RetryInfo', retryDelay: '1.5s' }] } }), 1500);
  assert.equal(parseRetryAfterMs({ headers: { get: () => null } }, {}), null);
});

test('generateWithRetry: reintenta transitorios con backoff, nunca timeout ni errores permanentes', async () => {
  const sleeps = [];
  const sleep = async (ms) => { sleeps.push(ms); };
  const flaky = (errors) => ({ calls: 0, async generate() { this.calls++; if (errors.length) throw errors.shift(); return { text: 'ok' }; } });

  const network = flaky([new AiProviderError('x', { code: 'network' })]);
  assert.equal((await generateWithRetry(network, {}, { maxRetries: 1, sleep })).text, 'ok');
  assert.deepEqual(sleeps, [1000]); // backoff por defecto

  const auth = flaky([new AiProviderError('x', { code: 'auth' })]);
  await assert.rejects(generateWithRetry(auth, {}, { sleep }), /x/);
  assert.equal(auth.calls, 1);

  const timeout = flaky([new AiProviderError('x', { code: 'timeout' })]);
  await assert.rejects(generateWithRetry(timeout, {}, { sleep }));
  assert.equal(timeout.calls, 1);
});
