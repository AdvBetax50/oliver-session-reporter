import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAiProvider, AiProviderError } from '../src/ai/index.js';
import { GeminiProvider } from '../src/ai/providers/gemini.provider.js';

const common = { model: 'gemini-test', temperature: 0.4, maxOutputTokens: 256, timeoutMs: 1000 };

function fakeFetch(status, payload, calls = []) {
  return async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return { ok: status >= 200 && status < 300, status, json: async () => payload };
  };
}

test('la factoría elige el proveedor según AI_PROVIDER', () => {
  assert.equal(createAiProvider({ AI_PROVIDER: 'mock' }).name, 'mock');
  const gemini = createAiProvider({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', AI_TEMPERATURE: '0.1' });
  assert.equal(gemini.name, 'gemini');
  assert.equal(gemini.model, 'gemini-2.5-flash');
  assert.equal(gemini.temperature, 0.1);
});

test('proveedor desconocido o sin API key falla con un error claro', () => {
  assert.throws(() => createAiProvider({ AI_PROVIDER: 'nope' }), /no soportado/);
  assert.throws(() => createAiProvider({ AI_PROVIDER: 'gemini' }), /GEMINI_API_KEY/);
});

test('el mock responde sin red', async () => {
  const res = await createAiProvider({ AI_PROVIDER: 'mock' }).generate({ prompt: 'hola' });
  assert.equal(res.provider, 'mock');
  assert.match(res.text, /mock/);
});

test('Gemini: arma la petición y normaliza la respuesta al contrato común', async () => {
  const calls = [];
  const provider = new GeminiProvider({
    ...common, apiKey: 'secret', baseUrl: 'https://example.test/v1beta/',
    fetchImpl: fakeFetch(200, {
      candidates: [{ content: { parts: [{ text: 'Hola ' }, { text: 'coach' }] } }],
      usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 3 },
      modelVersion: 'gemini-test-001',
    }, calls),
  });

  const res = await provider.generate({ prompt: 'datos', system: 'eres analista', json: true });

  assert.deepEqual(res, {
    text: 'Hola coach', provider: 'gemini', model: 'gemini-test-001', usage: { inputTokens: 12, outputTokens: 3 },
  });
  assert.equal(calls[0].url, 'https://example.test/v1beta/models/gemini-test:generateContent');
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'secret');
  assert.ok(!calls[0].url.includes('secret'), 'la API key no debe ir en la URL');
  assert.equal(calls[0].body.systemInstruction.parts[0].text, 'eres analista');
  assert.equal(calls[0].body.generationConfig.responseMimeType, 'application/json');
  assert.equal(calls[0].body.generationConfig.maxOutputTokens, 256);
});

test('Gemini: errores HTTP y respuestas vacías se convierten en AiProviderError', async () => {
  const rateLimited = new GeminiProvider({
    ...common, apiKey: 'k', baseUrl: 'https://x', fetchImpl: fakeFetch(429, { error: { message: 'quota' } }),
  });
  await assert.rejects(rateLimited.generate({ prompt: 'x' }), (e) => e instanceof AiProviderError && e.status === 429);

  const blocked = new GeminiProvider({
    ...common, apiKey: 'k', baseUrl: 'https://x', fetchImpl: fakeFetch(200, { promptFeedback: { blockReason: 'SAFETY' } }),
  });
  await assert.rejects(blocked.generate({ prompt: 'x' }), /SAFETY/);
});
