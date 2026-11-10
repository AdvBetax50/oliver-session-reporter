// Contrato común que deben cumplir todos los proveedores de IA.
//
// El resto de la aplicación solo conoce este contrato, nunca un SDK o API concreta.
// Para añadir un proveedor nuevo (OpenAI, Anthropic, Ollama...):
//   1. Crear providers/<nombre>.provider.js que extienda AiProvider e implemente generate().
//   2. Registrarlo en ai/index.js (PROVIDERS) junto a la lectura de su configuración.
//   3. Cambiar AI_PROVIDER=<nombre> en el .env. No hay que tocar nada más.

/**
 * @typedef {Object} AiRequest
 * @property {string}  prompt          Mensaje del usuario (los datos a interpretar).
 * @property {string} [system]         Instrucciones de sistema (rol, tono, formato).
 * @property {number} [temperature]    Sobrescribe la temperatura por defecto.
 * @property {number} [maxOutputTokens] Sobrescribe el máximo de tokens por defecto.
 * @property {boolean}[json]           Pide al modelo que responda en JSON.
 *
 * @typedef {Object} AiResponse
 * @property {string} text      Texto generado.
 * @property {string} provider  Proveedor que respondió.
 * @property {string} model     Modelo que respondió.
 * @property {{inputTokens: number|null, outputTokens: number|null}} usage
 */

export class AiProviderError extends Error {
  constructor(message, { provider, status = 502, cause } = {}) {
    super(message, { cause });
    this.name = 'AiProviderError';
    this.provider = provider;
    this.status = status; // 502 por defecto: el fallo es de un servicio externo
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
