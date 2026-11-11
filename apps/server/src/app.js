import express from 'express';
import cors from 'cors';
import * as repositories from './repositories/index.js';
import { getAiProvider, readRetryConfig } from './ai/index.js';
import { createSessionService } from './services/session.service.js';
import { createReportService } from './services/report/report.service.js';
import { createSessionsRouter } from './routes/sessions.routes.js';
import healthRouter from './routes/health.js';

// Composición de dependencias. Los tests pasan sus propias implementaciones
// (repositorios en memoria, IA simulada) sin necesidad de PostgreSQL ni de red.
export function createDefaultDeps({ repos = repositories, getAi = getAiProvider, retry = readRetryConfig() } = {}) {
  const sessionService = createSessionService(repos);
  const reportService = createReportService({ sessionService, getAi, retry });
  return { sessionService, reportService };
}

export function createApp(deps = createDefaultDeps()) {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json({ limit: '10kb' }));

  app.use('/health', healthRouter);
  app.use('/sessions', createSessionsRouter(deps));

  app.use((req, res) => res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` }));

  // Manejador de errores centralizado. Solo se devuelve el mensaje de los errores
  // marcados como `expose` (validación, 404, proveedor de IA, JSON mal formado);
  // el resto se registra en el servidor y se responde con un mensaje genérico.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status ?? err.statusCode ?? 500;
    if (status >= 500) console.error(`[${err.name}${err.code ? `:${err.code}` : ''}] ${err.message}`);
    // Rate limit del proveedor de IA: se indica al cliente cuándo puede reintentar.
    if (status === 429 && err.retryAfterMs) res.set('Retry-After', String(Math.ceil(err.retryAfterMs / 1000)));
    res.status(status).json({
      error: err.expose ? err.message : 'Internal server error',
      ...(err.code && err.expose && { code: err.code }),
    });
  });

  return app;
}
