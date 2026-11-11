import { AiProviderError } from './ai-provider.js';

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Llama al proveedor reintentando solo los errores transitorios (rate limit, 5xx, red).
 * - Respeta el tiempo de espera que indica el proveedor (Retry-After / RetryInfo).
 * - Si la espera pedida supera `maxWaitMs`, no espera: propaga el 429 para que el cliente
 *   reintente más tarde (no se deja una petición HTTP colgada medio minuto).
 * - El timeout NO se reintenta: duplicaría el tiempo de espera del usuario.
 */
export async function generateWithRetry(ai, request, { maxRetries = 1, maxWaitMs = 5000, sleep = defaultSleep } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await ai.generate(request);
    } catch (err) {
      const wait = err.retryAfterMs ?? 1000 * 2 ** attempt; // backoff exponencial por defecto
      if (!(err instanceof AiProviderError) || !err.retryable || attempt >= maxRetries || wait > maxWaitMs) throw err;
      await sleep(wait);
    }
  }
}
