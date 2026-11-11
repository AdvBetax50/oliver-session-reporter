import { parsePositiveInt, requireEnum, singleValue } from './validation.js';

export const LANGUAGES = ['es', 'en'];
export const AUDIENCES = ['coach', 'player'];

// Parámetros de POST /sessions/:id/report. Se aceptan en el body JSON
// (preferido) o en la query string; el body tiene prioridad.
export class ReportRequestDTO {
  constructor({ sessionId, language, audience }) {
    this.sessionId = sessionId;
    this.language = language;
    this.audience = audience;
    Object.freeze(this);
  }

  static fromRequest(params, body = {}, query = {}) {
    const language = body?.language ?? singleValue(query.language, 'language') ?? 'es';
    const audience = body?.audience ?? singleValue(query.audience, 'audience') ?? 'coach';
    return new ReportRequestDTO({
      sessionId: parsePositiveInt(params.id, 'id'),
      language: requireEnum(language, 'language', LANGUAGES),
      audience: requireEnum(audience, 'audience', AUDIENCES),
    });
  }
}
