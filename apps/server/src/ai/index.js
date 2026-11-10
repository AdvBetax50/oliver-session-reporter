// Factoría de proveedores de IA. Es el ÚNICO lugar que lee variables de entorno de IA
// y el único que conoce las clases concretas. El resto de la app usa getAiProvider().
import { AiProviderError } from './ai-provider.js';
import { GeminiProvider } from './providers/gemini.provider.js';
import { MockProvider } from './providers/mock.provider.js';

// Registro: nombre en AI_PROVIDER -> función que construye el proveedor con su configuración.
const PROVIDERS = {
  gemini: (env, common) =>
    new GeminiProvider({
      ...common,
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL || 'gemini-2.5-flash',
      baseUrl: env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
    }),
  mock: (env, common) => new MockProvider({ ...common, model: env.MOCK_MODEL }),
};

const numberOr = (value, fallback) => (value === undefined || value === '' ? fallback : Number(value));

export function createAiProvider(env = process.env) {
  const name = (env.AI_PROVIDER || 'gemini').toLowerCase();
  const factory = PROVIDERS[name];
  if (!factory) {
    throw new AiProviderError(
      `AI_PROVIDER="${name}" no soportado. Opciones: ${Object.keys(PROVIDERS).join(', ')}`,
      { provider: name, status: 500 },
    );
  }

  // Parámetros comunes a cualquier proveedor
  const common = {
    temperature: numberOr(env.AI_TEMPERATURE, 0.4),
    maxOutputTokens: numberOr(env.AI_MAX_OUTPUT_TOKENS, 1024),
    timeoutMs: numberOr(env.AI_TIMEOUT_MS, 30000),
  };
  return factory(env, common);
}

// Instancia perezosa: se crea en el primer uso, así el servidor arranca aunque falte la key.
let instance;
export function getAiProvider() {
  instance ??= createAiProvider();
  return instance;
}

export const SUPPORTED_AI_PROVIDERS = Object.keys(PROVIDERS);
export { AiProvider, AiProviderError } from './ai-provider.js';
