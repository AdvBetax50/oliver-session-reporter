import { AiProvider, AiProviderError } from '../ai-provider.js';

// Proveedor Gemini (Google AI Studio) vía API REST con fetch nativo.
// Docs: https://ai.google.dev/api/generate-content
export class GeminiProvider extends AiProvider {
  /**
   * @param {object} config
   * @param {string} config.apiKey
   * @param {string} config.baseUrl
   * @param {typeof fetch} [config.fetchImpl]  Inyectable para tests.
   */
  constructor({ apiKey, baseUrl, fetchImpl = fetch, ...options }) {
    super('gemini', options);
    if (!apiKey) throw new AiProviderError('Falta GEMINI_API_KEY en el .env', { provider: 'gemini', status: 500 });
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetch = fetchImpl;
  }

  async generate({ prompt, system, temperature, maxOutputTokens, json = false }) {
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: temperature ?? this.temperature,
        maxOutputTokens: maxOutputTokens ?? this.maxOutputTokens,
        ...(json && { responseMimeType: 'application/json' }),
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
      const reason = err.name === 'TimeoutError' ? `timeout de ${this.timeoutMs} ms` : err.message;
      throw new AiProviderError(`No se pudo contactar con Gemini: ${reason}`, { provider: this.name, status: 504, cause: err });
    }

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new AiProviderError(`Gemini respondió ${res.status}: ${payload?.error?.message ?? 'error desconocido'}`, {
        provider: this.name,
        status: res.status === 429 ? 429 : 502,
      });
    }

    const candidate = payload.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) {
      const reason = candidate?.finishReason ?? payload.promptFeedback?.blockReason ?? 'respuesta vacía';
      throw new AiProviderError(`Gemini no devolvió texto (${reason})`, { provider: this.name });
    }

    return {
      text,
      provider: this.name,
      model: payload.modelVersion ?? this.model,
      usage: {
        inputTokens: payload.usageMetadata?.promptTokenCount ?? null,
        outputTokens: payload.usageMetadata?.candidatesTokenCount ?? null,
      },
    };
  }
}
