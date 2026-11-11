// Migraciones y seed (src/db/setup.js) con un cliente de base de datos simulado:
// verifica el control transaccional sin necesitar PostgreSQL (el comportamiento real se
// cubre en test/integration).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runMigrations, seedDatabase } from '../src/db/setup.js';
import { rawSeed } from './helpers/in-memory-repos.js';

// Cliente falso: registra cada query y falla en la que coincida con `failOn`.
function fakeClient({ applied = [], failOn = null } = {}) {
  const queries = [];
  return {
    queries,
    async query(text, params) {
      queries.push(typeof text === 'string' ? text.trim().split('\n')[0] : text);
      if (failOn && String(text).includes(failOn)) throw Object.assign(new Error('boom'), { code: 'XX000' });
      if (String(text).startsWith('SELECT name FROM schema_migrations')) return { rows: applied.map((name) => ({ name })) };
      return { rows: [], rowCount: 0, params };
    },
  };
}

async function migrationsDir(files) {
  const dir = await mkdtemp(path.join(tmpdir(), 'oliver-mig-'));
  for (const [name, sql] of Object.entries(files)) await writeFile(path.join(dir, name), sql);
  return pathToFileURL(`${dir}${path.sep}`);
}

test('runMigrations: aplica en orden solo las pendientes, cada una en su transacción', async () => {
  const dir = await migrationsDir({ '002_b.sql': 'CREATE TABLE b();', '001_a.sql': 'CREATE TABLE a();', 'notes.txt': 'x' });
  const client = fakeClient({ applied: ['001_a.sql'] });
  assert.deepEqual(await runMigrations(client, dir), ['002_b.sql']);
  assert.deepEqual(client.queries.slice(2), ['BEGIN', 'CREATE TABLE b();', 'INSERT INTO schema_migrations (name) VALUES ($1)', 'COMMIT']);
});

test('runMigrations: si una migración falla se hace ROLLBACK y se informa cuál', async () => {
  const dir = await migrationsDir({ '001_bad.sql': 'CREATE TABLE broken(' });
  const client = fakeClient({ failOn: 'broken' });
  await assert.rejects(runMigrations(client, dir), /Falló la migración 001_bad\.sql: boom/);
  assert.equal(client.queries.at(-1), 'ROLLBACK');
  assert.ok(!client.queries.includes('COMMIT'));
});

test('seedDatabase: todo en una transacción, en orden de dependencias (FK)', async () => {
  const client = fakeClient();
  const result = await seedDatabase(client, rawSeed);
  assert.deepEqual({ ...result, warnings: undefined }, { players: 12, sessions: 3, playerSessions: 36, thresholds: 4, warnings: undefined });
  const q = client.queries;
  assert.equal(q[0], 'BEGIN');
  assert.equal(q.at(-1), 'COMMIT');
  const first = (table) => q.findIndex((x) => x.startsWith(`INSERT INTO ${table}`));
  assert.ok(first('teams') < first('players') && first('players') < first('sessions') && first('sessions') < first('player_sessions'));
});

test('seedDatabase: si falla un insert, ROLLBACK y se propaga el error', async () => {
  const client = fakeClient({ failOn: 'INSERT INTO sessions' });
  await assert.rejects(seedDatabase(client, rawSeed), { code: 'XX000' });
  assert.equal(client.queries.at(-1), 'ROLLBACK');
  assert.ok(!client.queries.includes('COMMIT'));
});

test('seedDatabase: un JSON inválido se rechaza ANTES de abrir la transacción', async () => {
  const bad = structuredClone(rawSeed);
  bad.players[0].position = 'XX';
  const client = fakeClient();
  await assert.rejects(seedDatabase(client, bad), { name: 'ValidationError' });
  assert.deepEqual(client.queries, [], 'no se ejecutó ninguna query');
});
