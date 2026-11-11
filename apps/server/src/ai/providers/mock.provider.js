import { AiProvider } from '../ai-provider.js';

// Proveedor falso y determinista: permite desarrollar y testear sin API key, red ni coste.
// Devuelve un resumen mínimo sin destacados ni comentarios: el reporte se completa con los
// textos de respaldo verificados, lo que permite ver ese camino en la UI.
export class MockProvider extends AiProvider {
  constructor(options) {
    super('mock', { ...options, model: options.model || 'mock-1' });
  }

  async generate({ json = false, schema }) {
    const text = json || schema
      ? JSON.stringify({ summary: '[mock] Example report generated without calling a real model.', highlights: [], alerts: [] })
      : '[mock] Example report generated without calling a real model.';
    return { text, provider: this.name, model: this.model, finishReason: 'STOP', usage: { inputTokens: null, outputTokens: null } };
  }
}
