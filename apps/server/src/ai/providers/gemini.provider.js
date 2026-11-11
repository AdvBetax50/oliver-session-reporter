import { AiProvider, AiProviderError } from '../ai-provider.js';

// Proveedor Gemini (Google AI Studio) vía API REST con fetch nativo.
// Docs: https://ai.google.dev/api/generate-content

// JSON Schema neutral -> Schema de Gemini (subconjunto OpenAPI con tipos en mayúsculas).
export function toGeminiSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const out = {};
  if (schema.type) out.type = String(schema.type).toUpperCase();
  for (const key of ['description', 'enum', 'required', 'minItems', 'maxItems', 'nullable', 'format']) {
    if (schema[key] !== undefined) out[key] = schema[key];
  }
  if (schema.properties) {
    out.properties = Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, toGeminiSchema(v)]));
    out.propertyOrdering = Object.keys(schema.properties); // fuerza "summary" primero
  }
  if (schema.items) out.items = toGeminiSchema(schema.items);
  return out;
}

// Tiempo de espera sugerido ante un 429: cabecera Retry-After o google.rpc.RetryInfo ("17s").
export function parseRetryAfterMs(res, payload) {
  const header = res.headers?.get?.('retry-after');
  if (header && Number.isFinite(Number(header))) return Number(header) * 1000;
  const info = payload?.error?.details?.find((d) => String(d['@type']).endsWith('RetryInfo'));
  const match = String(info?.retryDelay ?? '').match(/^([\d.]+)s$/);
  return match ? Math.ceil(Number(match[1]) * 1000) : null;
}

export class GeminiProvider extends AiProvider {
  /**
   * @param {object} config
   * @param {string} config.apiKey
   * @param {string} config.baseUrl
   * @param {typeof fetch} [config.fetchImpl]  Inyectable para tests.
   */
  constructor({ apiKey, baseUrl, fetchImpl = fetch, ...options }) {
    super('gemini', options);
    if (!apiKey) throw new AiProviderError('Falta GEMINI_API_KEY en el .env', { provider: 'gemini', code: 'config' });
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetch = fetchImpl;
  }

  async generate({ prompt, system, temperature, maxOutputTokens, json = false, schema }) {
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: temperature ?? this.temperature,
        maxOutputTokens: maxOutputTokens ?? this.maxOutputTokens,
        ...((json || schema) && { responseMimeType: 'application/json' }),
        ...(schema && { responseSchema: toGeminiSchema(schema) }),
      },
      ...(system && { systemInstruction: { parts: [{ text: system }] } }),
    };

    let res;
    try {
      res = await this.fetch(`${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent`, {
        method: 'POST',
        // La clave va en cabecera, no en la URL, para que no aparezca en logs.
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        throw new AiProviderError(`Gemini no respondió en ${this.timeoutMs} ms`, { provider: this.name, code: 'timeout', cause: err });
      }
      throw new AiProviderError(`No se pudo contactar con Gemini: ${err.message}`, { provider: this.name, code: 'network', cause: err });
    }

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = payload?.error?.message ?? 'error desconocido';
      if (res.status === 429) {
        throw new AiProviderError(`Gemini: límite de peticiones o cuota superado (${detail})`, {
          provider: this.name, code: 'rate_limit', retryAfterMs: parseRetryAfterMs(res, payload),
        });
      }
      const code = res.status >= 500 ? 'unavailable' : [401, 403].includes(res.status) ? 'auth' : 'provider_error';
      throw new AiProviderError(`Gemini respondió ${res.status}: ${detail}`, { provider: this.name, code });
    }

    const candidate = payload.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) {
      const reason = candidate?.finishReason ?? payload.promptFeedback?.blockReason ?? 'respuesta vacía';
      throw new AiProviderError(`Gemini no devolvió texto (${reason})`, { provider: this.name, code: 'invalid_response' });
    }

    return {
      text,
      provider: this.name,
      model: payload.modelVersion ?? this.model,
      finishReason: candidate?.finishReason ?? null, // MAX_TOKENS => JSON truncado; lo detecta el validador
      usage: {
        inputTokens: payload.usageMetadata?.promptTokenCount ?? null,
        outputTokens: payload.usageMetadata?.candidatesTokenCount ?? null,
      },
    };
  }
}
