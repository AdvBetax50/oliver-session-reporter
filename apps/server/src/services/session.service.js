import { NotFoundError } from '../errors.js';
import { evaluateAlerts, thresholdsToMap } from './alerts.js';

/**
 * @param {object} repos  Repositorios (inyectados: en tests se usan implementaciones en memoria).
 */
export function createSessionService(repos) {
  async function requireSession(sessionId) {
    const session = await repos.findSessionById(sessionId);
    if (!session) throw new NotFoundError(`La sesión ${sessionId} no existe`);
    return session;
  }

  return {
    // GET /sessions — solo los campos del listado
    async listSessions() {
      const sessions = await repos.findAllSessions();
      return sessions.map(({ id, date, title, type }) => ({ id, date, title, type }));
    },

    // GET /sessions/:id/metrics
    async getSessionMetrics({ sessionId, playerId, orderBy, order }) {
      const session = await requireSession(sessionId);
      const [metrics, thresholds] = await Promise.all([
        repos.findMetricsBySession(session.id, { playerId, orderBy, order }),
        repos.findThresholdsByTeam(session.teamId),
      ]);
      return {
        session,
        query: { playerId, orderBy, order },
        thresholds: thresholdsToMap(thresholds),
        metrics,
        alerts: evaluateAlerts(metrics, thresholds),
      };
    },

    // Datos completos de una sesión (sin filtros) para construir el reporte
    async getSessionContext(sessionId) {
      const session = await requireSession(sessionId);
      const [metrics, thresholds] = await Promise.all([
        repos.findMetricsBySession(session.id),
        repos.findThresholdsByTeam(session.teamId),
      ]);
      return { session, metrics, thresholds };
    },
  };
}
