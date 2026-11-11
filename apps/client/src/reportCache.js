// Caché de reportes de IA en el navegador (localStorage).
//
// Reglas (decididas por el usuario, ver log.md):
//  - Clave: sesión + idioma + audiencia (cada combinación se genera una sola vez).
//  - Solo se guarda un reporte que pasó la validación anti-alucinación (meta.validation.passed).
//    Uno con partes de respaldo ("Data-based") no queda congelado: se puede volver a pedir a la IA.
//  - El primero que se guarda NO se sobreescribe nunca.
//  - localStorage puede no estar disponible (modo privado, cuota llena, bloqueado): la app sigue
//    funcionando sin caché, nunca rompe.

// La versión del formato permite invalidar todo el caché si cambia la forma de la respuesta.
export const CACHE_PREFIX = 'oliver:report:v1';

export const cacheKey = (sessionId, language, audience) => `${CACHE_PREFIX}:${sessionId}:${language}:${audience}`;

export const isCacheable = (data) => data?.meta?.validation?.passed === true;

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null; // acceso bloqueado (p. ej. cookies deshabilitadas)
  }
}

// Comprueba que lo leído tenga la forma de un reporte de la API (protege contra datos corruptos o editados).
function isValidEntry(data, sessionId, language, audience) {
  return Boolean(
    data
      && data.session?.id === sessionId
      && data.language === language
      && data.audience === audience
      && typeof data.report?.summary === 'string'
      && Array.isArray(data.report.highlights)
      && Array.isArray(data.report.alerts)
      && isCacheable(data),
  );
}

/** Devuelve el reporte guardado para la clave, o null si no hay (o si está corrupto). */
export function readCachedReport(sessionId, language, audience, storage = getStorage()) {
  if (!storage) return null;
  const key = cacheKey(sessionId, language, audience);
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const data = JSON.parse(raw);
    if (isValidEntry(data, sessionId, language, audience)) return data;
  } catch {
    // JSON inválido o storage inaccesible: se trata como ausente
  }
  try {
    storage.removeItem(key); // entrada corrupta: se descarta para que pueda guardarse una válida
  } catch {
    /* sin acceso */
  }
  return null;
}

/**
 * Guarda el reporte solo si es cacheable y no existe ya uno para su clave (nunca sobreescribe).
 * La clave se toma de la propia respuesta (session.id, language, audience).
 * @returns {'saved' | 'exists' | 'not-cacheable' | 'unavailable'}
 */
export function saveReportIfAbsent(data, storage = getStorage()) {
  if (!isCacheable(data)) return 'not-cacheable';
  if (!storage) return 'unavailable';
  const { id } = data.session;
  if (readCachedReport(id, data.language, data.audience, storage)) return 'exists';
  try {
    storage.setItem(cacheKey(id, data.language, data.audience), JSON.stringify(data));
    return 'saved';
  } catch {
    return 'unavailable'; // cuota llena, modo privado…
  }
}
