// Contrato común que deben cumplir todos los proveedores de IA.
//
// El resto de la aplicación solo conoce este contrato, nunca un SDK o API concreta.
// Para añadir un proveedor nuevo (OpenAI, Anthropic, Ollama...):
//   1. Crear providers/<nombre>.provider.js que extienda AiProvider e implemente generate().
//   2. Registrarlo en ai/index.js (PROVIDERS) junto a la lectura de su configuración.
//   3. Cambiar AI_PROVIDER=<nombre> en el .env. No hay que tocar nada más.

/**
 * @typedef {Object} AiRequest
 * @property {string}  prompt           Mensaje del usuario (los datos a interpretar).
 * @property {string} [system]          Instrucciones de sistema (rol, reglas, formato).
 * @property {number} [temperature]     Sobrescribe la temperatura por defecto.
 * @property {number} [maxOutputTokens] Sobrescribe el máximo de tokens por defecto.
 * @property {boolean}[json]            Pide al modelo que responda en JSON.
 * @property {object} [schema]          JSON Schema de la respuesta (salida estructurada), si el proveedor lo soporta.
 *
 * @typedef {Object} AiResponse
 * @property {string} text          Texto generado.
 * @property {string} provider      Proveedor que respondió.
 * @property {string} model         Modelo que respondió.
 * @property {string|null} finishReason  Motivo de fin (p. ej. STOP, MAX_TOKENS).
 * @property {{inputTokens: number|null, outputTokens: number|null}} usage
 */

/**
 * Códigos de error normalizados (independientes del proveedor):
 *  - timeout           el proveedor no respondió a tiempo                 -> HTTP 504
 *  - rate_limit        cuota o límite de peticiones superado              -> HTTP 429 (+ Retry-After)
 *  - unavailable       error 5xx / sobrecarga del proveedor               -> HTTP 502
 *  - network           no se pudo contactar con el proveedor              -> HTTP 502
 *  - invalid_response  respuesta vacía, bloqueada o con formato inválido  -> HTTP 502
 *  - auth              API key inválida o sin permisos                    -> HTTP 502
 *  - config            configuración local incorrecta (falta la key...)   -> HTTP 500
 *  - provider_error    otro error del proveedor                           -> HTTP 502
 */
const STATUS_BY_CODE = {
  timeout: 504, rate_limit: 429, unavailable: 502, network: 502,
  invalid_response: 502, auth: 502, config: 500, provider_error: 502,
};
const RETRYABLE = new Set(['rate_limit', 'unavailable', 'network']);

export class AiProviderError extends Error {
  constructor(message, { provider, code = 'provider_error', status, retryAfterMs = null, cause } = {}) {
    super(message, { cause });
    this.name = 'AiProviderError';
    this.provider = provider;
    this.code = code;
    this.status = status ?? STATUS_BY_CODE[code] ?? 502;
    this.retryable = RETRYABLE.has(code);
    this.retryAfterMs = retryAfterMs;
    this.expose = true; // el mensaje es seguro para el cliente (nunca incluye la API key)
  }
}

export class AiProvider {
  /**
   * @param {string} name
   * @param {{model: string, temperature: number, maxOutputTokens: number, timeoutMs: number}} options
   */
  constructor(name, { model, temperature, maxOutputTokens, timeoutMs }) {
    if (new.target === AiProvider) throw new TypeError('AiProvider es abstracta');
    this.name = name;
    this.model = model;
    this.temperature = temperature;
    this.maxOutputTokens = maxOutputTokens;
    this.timeoutMs = timeoutMs;
  }

  /**
   * @param {AiRequest} _request
   * @returns {Promise<AiResponse>}
   */
  // eslint-disable-next-line no-unused-vars
  async generate(_request) {
    throw new Error(`${this.name}: generate() no implementado`);
  }
}
