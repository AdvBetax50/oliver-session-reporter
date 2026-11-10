import { AiProvider } from '../ai-provider.js';

// Proveedor falso y determinista: permite desarrollar y testear sin API key ni coste.
export class MockProvider extends AiProvider {
  constructor(options) {
    super('mock', { ...options, model: options.model || 'mock-1' });
  }

  async generate({ prompt, json = false }) {
    const text = json
      ? JSON.stringify({ summary: '[mock] Reporte de ejemplo', highlights: [], alerts: [] })
      : `[mock] Reporte de ejemplo generado a partir de ${prompt.length} caracteres de datos.`;
    return { text, provider: this.name, model: this.model, usage: { inputTokens: null, outputTokens: null } };
  }
}
