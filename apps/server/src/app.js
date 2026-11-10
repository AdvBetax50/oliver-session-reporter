import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json());

  app.use('/api/health', healthRouter);

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  // Manejador de errores centralizado
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });

  return app;
}
