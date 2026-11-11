// Tests de integración contra PostgreSQL REAL.
// - Crean una base aislada (oliver_test_<pid>), le aplican migraciones + seed y la eliminan al final:
//   nunca tocan la base "oliver".
// - Usan las credenciales del .env (PGHOST, PGUSER, PGPASSWORD…); el usuario necesita CREATEDB.
// - Ejecutar con: npm run test:db  (si no hay PostgreSQL disponible, la suite se omite).
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { createApp, createDefaultDeps } from '../../src/app.js';
import { dropDatabase, ensureDatabase, readSeedFile, runMigrations, seedDatabase } from '../../src/db/setup.js';
import * as repositories from '../../src/repositories/index.js';
import { PlayerDTO } from '../../src/dtos/index.js';

const DB = `oliver_test_${process.pid}`;
let pool;
let unavailable = null;

before(async () => {
  try {
    await ensureDatabase(DB);
  } catch (err) {
    unavailable = `PostgreSQL no disponible (${err.code ?? err.message})`;
    return;
  }
  pool = new pg.Pool({ database: DB, max: 4 });
});

after(async () => {
  if (unavailable) return;
  await pool.end();
  await dropDatabase(DB);
});

// Repositorios ligados al pool de la base de test (los reales usan el pool global de la app)
const bound = () => ({
  findAllSessions: () => repositories.findAllSessions(pool),
  findSessionById: (id) => repositories.findSessionById(id, pool),
  findThresholdsByTeam: (teamId) => repositories.findThresholdsByTeam(teamId, pool),
  findMetricsBySession: (id, options) => repositories.findMetricsBySession(id, options, pool),
});

const count = async (table) => Number((await pool.query(`SELECT count(*) FROM ${table}`)).rows[0].count);

describe('PostgreSQL: migraciones y seed', { concurrency: false }, () => {
  test('las migraciones se aplican una vez y son idempotentes', async (t) => {
    if (unavailable) return t.skip(unavailable);
    const client = await pool.connect();
    try {
      assert.deepEqual(await runMigrations(client), ['001_initial_schema.sql']);
      assert.deepEqual(await runMigrations(client), [], 'la segunda ejecución no aplica nada');
    } finally {
      client.release();
    }
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
    );
    assert.deepEqual(rows.map((r) => r.table_name), [
      'metric_thresholds', 'player_sessions', 'players', 'schema_migrations', 'sessions', 'teams',
    ]);
  });

  test('el seed carga el JSON completo y es idempotente (UPSERT)', async (t) => {
    if (unavailable) return t.skip(unavailable);
    const raw = await readSeedFile();
    const client = await pool.connect();
    try {
      const first = await seedDatabase(client, raw);
      assert.deepEqual(
        { players: first.players, sessions: first.sessions, playerSessions: first.playerSessions, thresholds: first.thresholds },
        { players: 12, sessions: 3, playerSessions: 36, thresholds: 4 },
      );
      await seedDatabase(client, raw); // segunda vez
    } finally {
      client.release();
    }
    assert.deepEqual(
      [await count('teams'), await count('players'), await count('sessions'), await count('player_sessions'), await count('metric_thresholds')],
      [1, 12, 3, 36, 4],
      'sin duplicados tras ejecutar el seed dos veces',
    );
  });

  test('workload_au es una columna generada: coincide con el JSON y es NULL sin RPE', async (t) => {
    if (unavailable) return t.skip(unavailable);
    const raw = await readSeedFile();
    const { rows } = await pool.query('SELECT session_id, player_id, workload_au FROM player_sessions');
    const fromDb = new Map(rows.map((r) => [`${r.session_id}:${r.player_id}`, r.workload_au]));
    for (const s of raw.sessions) {
      for (const ps of s.player_sessions) assert.equal(fromDb.get(`${s.id}:${ps.player_id}`), ps.workload_au);
    }
    await assert.rejects(
      pool.query('UPDATE player_sessions SET workload_au = 1 WHERE session_id = 101 AND player_id = 1'),
      { code: '428C9' }, // generated_always: el código SQLSTATE no depende del idioma del servidor
    );
  });

  test('las restricciones de la base rechazan datos inválidos', async (t) => {
    if (unavailable) return t.skip(unavailable);
    await assert.rejects(pool.query('UPDATE player_sessions SET rpe = 11 WHERE session_id = 101 AND player_id = 1'), { code: '23514' }); // CHECK
    await assert.rejects(pool.query("UPDATE sessions SET type = 'friendly' WHERE id = 101"), { code: '23514' });
    await assert.rejects(pool.query('UPDATE players SET shirt_number = 8 WHERE id = 1'), { code: '23505' }); // UNIQUE (equipo, dorsal)
    await assert.rejects(
      pool.query(`INSERT INTO player_sessions (session_id, player_id, minutes_played, total_distance_m, high_speed_running_m,
                  sprints, max_speed_kmh, accelerations, rpe) VALUES (101, 999, 10, 1, 1, 1, 1, 1, 5)`),
      { code: '23503' }, // FK
    );
  });

  test('si un insert falla a mitad del seed, se revierte todo (transacción)', async (t) => {
    if (unavailable) return t.skip(unavailable);
    const raw = structuredClone(await readSeedFile());
    // Pasa la validación de DTOs pero viola UNIQUE (team_id, shirt_number) en la base
    raw.players.push({ id: 99, name: 'Jugador Duplicado', position: 'MF', shirt_number: 10 });
    const before = await count('players');
    const client = await pool.connect();
    try {
      await assert.rejects(seedDatabase(client, raw), { code: '23505' });
    } finally {
      client.release();
    }
    assert.equal(await count('players'), before, 'no quedó ningún insert parcial');
    assert.equal((await pool.query('SELECT 1 FROM players WHERE id = 99')).rowCount, 0);
  });
});

describe('PostgreSQL: repositorios y DTOs', { concurrency: false }, () => {
  test('findAllSessions: orden por fecha descendente y fechas sin desplazamiento de zona horaria', async (t) => {
    if (unavailable) return t.skip(unavailable);
    const sessions = await repositories.findAllSessions(pool);
    assert.deepEqual(sessions.map((s) => [s.id, s.date]), [[103, '2026-09-19'], [102, '2026-09-17'], [101, '2026-09-15']]);
    assert.equal(sessions[0].durationMin, 90);
    assert.equal(await repositories.findSessionById(999, pool), null);
  });

  test('findMetricsBySession: orden real en SQL, NULLS LAST, filtro por jugador y tipos', async (t) => {
    if (unavailable) return t.skip(unavailable);
    const byDistance = await repositories.findMetricsBySession(103, { orderBy: 'total_distance_m', order: 'desc' }, pool);
    const distances = byDistance.map((m) => m.totalDistanceM);
    assert.deepEqual(distances, [...distances].sort((a, b) => b - a));
    assert.equal(byDistance[0].player.name, 'Santiago Molina');
    assert.equal(typeof byDistance[0].maxSpeedKmh, 'number', 'NUMERIC llega como number');

    for (const order of ['asc', 'desc']) {
      const byRpe = await repositories.findMetricsBySession(103, { orderBy: 'rpe', order }, pool);
      assert.equal(byRpe.at(-1).playerId, 9, `RPE null al final (${order})`);
      assert.equal(byRpe.at(-1).workloadAu, null);
    }

    // Empate en workload (810): desempata por dorsal (Molina #6 antes que Acosta #11)
    const byWorkload = await repositories.findMetricsBySession(103, { orderBy: 'workload_au', order: 'desc' }, pool);
    assert.deepEqual(byWorkload.slice(0, 2).map((m) => m.playerId), [5, 10]);

    const one = await repositories.findMetricsBySession(103, { playerId: 5 }, pool);
    assert.equal(one.length, 1);
    assert.deepEqual(one[0].player, { name: 'Santiago Molina', position: 'MF', shirtNumber: 6 });

    const byName = await repositories.findMetricsBySession(101, { orderBy: 'name', order: 'asc' }, pool);
    assert.equal(byName[0].player.name, 'Agustín Castro');
  });

  test('findThresholdsByTeam / findTeamById / findPlayersByTeam devuelven DTOs con tipos correctos', async (t) => {
    if (unavailable) return t.skip(unavailable);
    const thresholds = await repositories.findThresholdsByTeam(42, pool);
    assert.deepEqual(
      thresholds.map((x) => [x.metric, x.warning, x.critical]),
      [['rpe', 8, null], ['sprints', 28, null], ['total_distance_m', 9500, null], ['workload_au', 600, 750]],
    );
    assert.deepEqual({ ...(await repositories.findTeamById(42, pool)) }, { id: 42, name: 'Club Atlético Ficticio - Primera', sport: 'football' });
    const players = await repositories.findPlayersByTeam(42, pool);
    assert.equal(players.length, 12);
    assert.ok(players.every((p) => p instanceof PlayerDTO));
    assert.equal(players[0].shirtNumber, 1, 'ordenados por dorsal');
  });
});

describe('PostgreSQL: API completa sobre la base real', { concurrency: false }, () => {
  let server;
  let base;
  before(async () => {
    if (unavailable) return;
    const app = createApp(createDefaultDeps({ repos: bound(), getAi: () => { throw new Error('no se usa'); } }));
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://localhost:${server.address().port}`;
  });
  after(() => server?.close());

  test('GET /sessions y GET /sessions/:id/metrics con orden, filtro y alertas', async (t) => {
    if (unavailable) return t.skip(unavailable);
    const sessions = await (await fetch(`${base}/sessions`)).json();
    assert.deepEqual(sessions.map((s) => s.id), [103, 102, 101]);

    const res = await fetch(`${base}/sessions/103/metrics?order_by=sprints&order=desc`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.metrics[0].playerId, 10); // 29 sprints
    assert.deepEqual(body.thresholds.workload_au, { warning: 600, critical: 750 });
    assert.deepEqual(body.alerts.filter((a) => a.level === 'critical').map((a) => a.playerId).sort((a, b) => a - b), [5, 10]);

    assert.equal((await fetch(`${base}/sessions/999/metrics`)).status, 404);
  });

  test('GET /health responde ok contra la base configurada', async (t) => {
    if (unavailable) return t.skip(unavailable);
    const res = await fetch(`${base}/health`);
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.status, 'ok');
  });
});
