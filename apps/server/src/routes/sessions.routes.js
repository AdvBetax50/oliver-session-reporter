import { Router } from 'express';
import { MetricsQueryDTO, ReportRequestDTO } from '../dtos/index.js';

// Las rutas solo traducen HTTP <-> servicios: validan la entrada con DTOs y responden.
// Express 5 envía al error handler los errores de los handlers async.
export function createSessionsRouter({ sessionService, reportService }) {
  const router = Router();

  // GET /sessions
  router.get('/', async (_req, res) => {
    res.json(await sessionService.listSessions());
  });

  // GET /sessions/:id/metrics?player_id=5&order_by=total_distance_m&order=desc
  router.get('/:id/metrics', async (req, res) => {
    const query = MetricsQueryDTO.fromRequest(req.params, req.query);
    res.json(await sessionService.getSessionMetrics(query));
  });

  // POST /sessions/:id/report   body: { "language": "es" | "en", "audience": "coach" | "player" }
  router.post('/:id/report', async (req, res) => {
    const request = ReportRequestDTO.fromRequest(req.params, req.body, req.query);
    res.json(await reportService.generateReport(request));
  });

  return router;
}
