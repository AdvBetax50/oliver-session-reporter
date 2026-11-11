import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, createDefaultDeps } from '../src/app.js';
import { buildMetricsQuery } from '../src/repositories/player-session.repository.js';
import { AiProviderError } from '../src/ai/index.js';
import { createInMemoryRepos } from './helpers/in-memory-repos.js';

// IA simulada: registra las peticiones. Devuelve en orden lo encolado en `queue`
// (texto o Error a lanzar) y, cuando la cola se vacía, `nextText`.
const ai = {
  name: 'fake',
  calls: [],
  queue: [],
  nextText: '{}',
  reset(nextText = '{}', queue = []) {
    this.calls = [];
    this.queue = queue;
    this.nextText = nextText;
  },
  async generate(request) {
    this.calls.push(request);
    const next = this.queue.length ? this.queue.shift() : this.nextText;
    if (next instanceof Error) throw next;
    return { text: next, provider: 'fake', model: 'fake-1', usage: { inputTokens: 1, outputTokens: 1 } };
  },
};
const sleeps = [];

let server;
let base;

before(async () => {
  const retry = { maxRetries: 1, maxWaitMs: 5000, sleep: async (ms) => { sleeps.push(ms); } };
  const app = createApp(createDefaultDeps({ repos: createInMemoryRepos(), getAi: () => ai, retry }));
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

const get = async (path) => {
  const res = await fetch(base + path);
  return { status: res.status, body: await res.json() };
};
const post = async (path, body) => {
  const res = await fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: res.status, headers: res.headers, body: await res.json() };
};

describe('GET /sessions', () => {
  test('lista las sesiones con id, fecha, título y tipo, de la más reciente a la más antigua', async () => {
    const { status, body } = await get('/sessions');
    assert.equal(status, 200);
    assert.deepEqual(body.map((s) => s.id), [103, 102, 101]);
    assert.deepEqual(Object.keys(body[0]).sort(), ['date', 'id', 'title', 'type']);
    assert.deepEqual(body[0], { id: 103, date: '2026-09-19', title: 'Partido amistoso vs. Deportivo Ejemplo', type: 'match' });
  });
});

describe('GET /sessions/:id/metrics', () => {
  test('devuelve las métricas de los 12 jugadores, umbrales y alertas calculadas', async () => {
    const { status, body } = await get('/sessions/103/metrics');
    assert.equal(status, 200);
    assert.equal(body.metrics.length, 12);
    assert.deepEqual(body.thresholds.workload_au, { warning: 600, critical: 750 });
    assert.equal(body.metrics[0].player.name, 'Nicolás Herrera'); // orden por defecto: dorsal 1
    const molina = body.alerts.find((a) => a.playerId === 5);
    assert.equal(molina.level, 'critical');
    assert.deepEqual(molina.breaches.map((b) => b.metric).sort(), ['rpe', 'total_distance_m', 'workload_au']);
    assert.ok(!body.alerts.some((a) => a.playerId === 9), 'RPE nulo no genera alerta');
  });

  test('filtra por jugador (?player_id=5)', async () => {
    const { body } = await get('/sessions/103/metrics?player_id=5');
    assert.equal(body.metrics.length, 1);
    assert.equal(body.metrics[0].playerId, 5);
    assert.equal(body.metrics[0].totalDistanceM, 10488);
  });

  test('ordena por una métrica (?order_by=total_distance_m&order=desc)', async () => {
    const { body } = await get('/sessions/103/metrics?order_by=total_distance_m&order=desc');
    const distances = body.metrics.map((m) => m.totalDistanceM);
    assert.deepEqual(distances, [...distances].sort((a, b) => b - a));
    assert.equal(body.metrics[0].playerId, 5);
  });

  test('los RPE nulos quedan al final en ambas direcciones', async () => {
    for (const order of ['asc', 'desc']) {
      const { body } = await get(`/sessions/103/metrics?order_by=rpe&order=${order}`);
      assert.equal(body.metrics.at(-1).rpe, null);
    }
  });

  test('parámetros inválidos -> 400; sesión inexistente -> 404', async () => {
    assert.equal((await get('/sessions/abc/metrics')).status, 400);
    assert.equal((await get('/sessions/103/metrics?order_by=password')).status, 400);
    assert.equal((await get('/sessions/103/metrics?order=sideways')).status, 400);
    assert.equal((await get('/sessions/103/metrics?player_id=-1')).status, 400);
    const missing = await get('/sessions/999/metrics');
    assert.equal(missing.status, 404);
    assert.match(missing.body.error, /999/);
  });
});

describe('POST /sessions/:id/report', () => {
  const modelReport = {
    summary: 'Buen partido con carga alta.',
    highlights: [
      { player_id: 5, reason: 'Mayor distancia del equipo.' },
      { player_id: 999, reason: 'Jugador inventado.' }, // debe descartarse
      { player_id: 10, reason: '29 sprints.' },
    ],
    alerts: [
      { player_id: 5, comment: 'Reducir carga mañana.' },
      { player_id: 7, comment: 'Alerta inventada.' }, // el arquero no supera umbrales: debe ignorarse
    ],
  };

  // Respuesta 100% válida para la sesión 103 (alertas: 5, 10, 2, 1, 6)
  const validReport = {
    summary: 'Partido de carga alta: el equipo promedió 6,868 m y 5 jugadores alcanzaron umbrales. Mateo Suárez no reportó RPE.',
    highlights: [
      { player_id: '5', reason: 'Santiago Molina lideró la distancia con 10,488 m (116.5 m/min).' },
      { player_id: '10', reason: 'Bruno Acosta hizo 29 sprints y 829 m a alta velocidad.' },
    ],
    alerts: [5, 10, 2, 1, 6].map((id) => ({ player_id: String(id), comment: 'Revisar la carga y priorizar la recuperación.' })),
  };

  test('respuesta válida: se usa tal cual, en un solo intento, con el prompt versionado', async () => {
    ai.reset('```json\n' + JSON.stringify(validReport) + '\n```'); // tolera vallas ```json
    const { status, body } = await post('/sessions/103/report', { language: 'en', audience: 'player' });

    assert.equal(status, 200);
    assert.equal(ai.calls.length, 1);
    assert.equal(body.meta.attempts, 1);
    assert.equal(body.meta.validation.passed, true);
    assert.deepEqual(body.meta.validation.fallbackFields, []);
    assert.equal(body.meta.promptVersion, 'session-report.v1');
    assert.equal(body.report.summarySource, 'ai');
    assert.deepEqual(body.report.highlights.map((h) => [h.playerId, h.source]), [[5, 'ai'], [10, 'ai']]);
    assert.deepEqual(body.report.alerts.map((a) => a.playerId).slice(0, 2).sort((a, b) => a - b), [5, 10]); // críticos primero
    assert.ok(body.report.alerts.every((a) => a.commentSource === 'ai'));
    assert.deepEqual(body.dataQuality.playersWithoutRpe, [{ playerId: 9, name: 'Mateo Suárez' }]);
    assert.deepEqual(body.dataQuality.lowMinutesPlayers, [{ playerId: 11, name: 'Franco Medina', minutesPlayed: 28 }]);

    // Idioma, audiencia, schema y contexto preciso
    const [request] = ai.calls;
    assert.match(request.system, /Write every text field in English/);
    assert.match(request.system, /players themselves/);
    assert.deepEqual([...request.schema.properties.alerts.items.properties.player_id.enum].sort(), ['1', '10', '2', '5', '6']);
    assert.equal(request.schema.properties.highlights.items.properties.player_id.enum.length, 12);
    const context = JSON.parse(request.prompt.slice(request.prompt.indexOf('{')));
    assert.equal(context.players.length, 12);
    assert.equal(context.players.find((p) => p.player_id === 11).low_minutes, true);
    assert.equal(context.players.find((p) => p.player_id === 9).rpe_reported, false);
    const molina = context.computed_alerts.find((a) => a.player_id === 5);
    assert.deepEqual(molina.breaches.find((b) => b.metric === 'workload_au'), {
      metric: 'workload_au', value: 810, level: 'critical', threshold_reached: 750, warning: 600, critical: 750, excess: 60, excess_pct: 8,
    });
  });

  test('número inventado -> reintento con los problemas -> se usa la respuesta corregida', async () => {
    const invented = { ...validReport, summary: 'El equipo corrió 99,999 m en total.' };
    ai.reset(JSON.stringify(validReport), [JSON.stringify(invented)]);
    const { status, body } = await post('/sessions/103/report', {});

    assert.equal(status, 200);
    assert.equal(ai.calls.length, 2);
    assert.match(ai.calls[1].prompt, /did not pass validation/);
    assert.match(ai.calls[1].prompt, /the number "99,999" does not appear/);
    assert.equal(body.meta.attempts, 2);
    assert.equal(body.meta.validation.passed, true);
    assert.equal(body.report.summary, validReport.summary);
    assert.equal(body.meta.validation.issues[0].issues[0].field, 'summary');
  });

  test('si el reintento también falla, cada campo inválido se reemplaza por texto verificado', async () => {
    const bad = {
      summary: 'Lionel Messi hizo 15,000 m.', // jugador y número inventados
      highlights: [
        { player_id: '5', reason: 'Mayor distancia del equipo.' }, // válido: se conserva
        { player_id: '999', reason: 'Jugador inventado.' }, // inexistente: se descarta
      ],
      alerts: [
        { player_id: '5', comment: 'Reducir carga mañana.' }, // válido
        { player_id: '7', comment: 'Alerta inventada.' }, // sin alerta calculada: se ignora
        { player_id: '10', comment: 'Superó el umbral por 61 AU.' }, // cálculo propio no enviado: inválido
      ],
    };
    ai.reset(JSON.stringify(bad));
    const { status, body } = await post('/sessions/103/report', { language: 'es' });

    assert.equal(status, 200);
    assert.equal(ai.calls.length, 2);
    assert.equal(body.meta.validation.passed, false);
    assert.equal(body.report.summarySource, 'fallback');
    assert.doesNotMatch(body.report.summary, /Messi|15/);
    assert.match(body.report.summary, /Sin RPE reportado: Mateo Suárez/);
    assert.match(body.report.summary, /Con pocos minutos: Franco Medina \(28 min\)/);
    assert.deepEqual(body.report.highlights.map((h) => [h.playerId, h.source]), [[5, 'ai'], [10, 'fallback']]);
    const byId = Object.fromEntries(body.report.alerts.map((a) => [a.playerId, a]));
    assert.ok(!byId[7]);
    assert.equal(byId[5].comment, 'Reducir carga mañana.');
    assert.equal(byId[10].commentSource, 'fallback');
    assert.match(byId[10].comment, /carga de trabajo 810 AU \(umbral crítico 750 AU\)/);
    assert.ok(body.meta.validation.fallbackFields.includes('summary'));
  });

  test('respuesta que no es JSON (dos veces) -> reporte completo de respaldo, nunca datos inventados', async () => {
    ai.reset('Lo siento, no puedo ayudar con eso.');
    const { status, body } = await post('/sessions/101/report', { language: 'en' });
    assert.equal(status, 200);
    assert.equal(body.report.summarySource, 'fallback');
    assert.equal(body.report.highlights.length, 2);
    assert.ok(body.report.highlights.every((h) => h.source === 'fallback'));
    assert.deepEqual(body.report.alerts, []); // la sesión 101 no supera ningún umbral
    assert.match(body.meta.validation.issues[0].issues[0].message, /not valid JSON/);
  });

  test('valores por defecto: language=es, audience=coach', async () => {
    ai.reset(JSON.stringify(validReport));
    const { body } = await post('/sessions/103/report', {});
    assert.equal(body.language, 'es');
    assert.equal(body.audience, 'coach');
    assert.match(ai.calls[0].system, /Spanish/);
    assert.match(ai.calls[0].system, /head coach/);
  });

  test('parámetros inválidos -> 400 sin llamar a la IA; sesión inexistente -> 404', async () => {
    ai.reset();
    assert.equal((await post('/sessions/103/report', { language: 'fr' })).status, 400);
    assert.equal((await post('/sessions/103/report', { audience: 'fan' })).status, 400);
    assert.equal((await post('/sessions/999/report', {})).status, 404);
    assert.equal(ai.calls.length, 0);
  });
});

describe('POST /sessions/:id/report — errores del proveedor', () => {
  const ok = JSON.stringify({ summary: 'Sesión sin alertas.', highlights: [{ player_id: '5', reason: 'Buen trabajo.' }, { player_id: '2', reason: 'Buen trabajo.' }], alerts: [] });
  const rateLimit = (retryAfterMs) => new AiProviderError('quota', { provider: 'fake', code: 'rate_limit', retryAfterMs });

  test('rate limit con espera corta -> espera lo indicado y reintenta', async () => {
    ai.reset(ok, [rateLimit(1500)]);
    sleeps.length = 0;
    const { status } = await post('/sessions/101/report', {});
    assert.equal(status, 200);
    assert.equal(ai.calls.length, 2);
    assert.deepEqual(sleeps, [1500]);
  });

  test('rate limit con espera larga -> 429 inmediato con Retry-After', async () => {
    ai.reset(ok, [rateLimit(60_000)]);
    const { status, headers, body } = await post('/sessions/101/report', {});
    assert.equal(status, 429);
    assert.equal(headers.get('retry-after'), '60');
    assert.equal(body.code, 'rate_limit');
    assert.equal(ai.calls.length, 1);
  });

  test('timeout -> 504 sin reintentar (no duplica la espera del usuario)', async () => {
    ai.reset(ok, [new AiProviderError('Gemini no respondió en 30000 ms', { provider: 'fake', code: 'timeout' })]);
    const { status, body } = await post('/sessions/101/report', {});
    assert.equal(status, 504);
    assert.equal(body.code, 'timeout');
    assert.equal(ai.calls.length, 1);
  });

  test('error 5xx persistente -> 502 tras agotar los reintentos', async () => {
    const down = () => new AiProviderError('Gemini respondió 503', { provider: 'fake', code: 'unavailable' });
    ai.reset(ok, [down(), down()]);
    const { status } = await post('/sessions/101/report', {});
    assert.equal(status, 502);
    assert.equal(ai.calls.length, 2);
  });
});

describe('SQL de métricas', () => {
  test('usa parámetros para los valores y la lista blanca para el orden', () => {
    const { text, params } = buildMetricsQuery(103, { playerId: 5, orderBy: 'total_distance_m', order: 'desc' });
    assert.deepEqual(params, [103, 5]);
    assert.match(text, /ps\.player_id = \$2/);
    assert.match(text, /ORDER BY ps\.total_distance_m DESC NULLS LAST/);
    assert.throws(() => buildMetricsQuery(103, { orderBy: 'id; DROP TABLE players' }));
  });
});

test('ruta desconocida -> 404 JSON', async () => {
  const { status, body } = await get('/nope');
  assert.equal(status, 404);
  assert.match(body.error, /no encontrada/);
});
