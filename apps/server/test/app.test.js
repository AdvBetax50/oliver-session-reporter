// Comportamiento transversal de Express (app.js): manejo de errores, límites y CORS.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { HttpError } from '../src/errors.js';

// Servicios falsos que permiten provocar cada tipo de error.
const deps = {
  sessionService: {
    async listSessions() {
      throw new Error('connection to server at "10.0.0.5" failed: password authentication failed for user "admin"');
    },
    async getSessionMetrics() {
      throw new HttpError(418, 'mensaje controlado');
    },
  },
  reportService: {
    async generateReport(req) {
      return { ok: true, req };
    },
  },
};

let server;
let base;
const errors = [];
const originalError = console.error;

before(async () => {
  console.error = (...args) => errors.push(args.join(' ')); // silencia y captura los logs de 5xx
  server = createApp(deps).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}`;
});
after(() => {
  console.error = originalError;
  server.close();
});

test('error inesperado -> 500 con mensaje genérico: no se filtran detalles internos al cliente', async () => {
  const res = await fetch(`${base}/sessions`);
  const body = await res.json();
  assert.equal(res.status, 500);
  assert.deepEqual(body, { error: 'Internal server error' });
  assert.doesNotMatch(JSON.stringify(body), /10\.0\.0\.5|password|admin/);
  assert.ok(errors.some((e) => e.includes('password authentication failed')), 'el detalle sí queda en el log del servidor');
});

test('errores controlados (expose) devuelven su status y mensaje', async () => {
  const res = await fetch(`${base}/sessions/1/metrics`);
  assert.equal(res.status, 418);
  assert.deepEqual(await res.json(), { error: 'mensaje controlado' });
});

test('JSON mal formado en el body -> 400', async () => {
  const res = await fetch(`${base}/sessions/1/report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"language": ' });
  assert.equal(res.status, 400);
});

test('body mayor a 10 kB -> 413', async () => {
  const res = await fetch(`${base}/sessions/1/report`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: 'es', pad: 'x'.repeat(11_000) }),
  });
  assert.equal(res.status, 413);
});

test('CORS: solo permite el origen del cliente configurado', async () => {
  const res = await fetch(`${base}/sessions/1/report`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' }, body: '{}',
  });
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
});
