// Lógica de creación de la base, migraciones y seed, reutilizable por los scripts CLI
// (scripts/*.js) y por los tests de integración (que la ejecutan sobre una base aislada).
import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';
import { parseSeedData } from './parse-seed-data.js';
import {
  upsertPlayer, upsertPlayerSession, upsertSession, upsertTeam, upsertThreshold,
} from '../repositories/index.js';

export const MIGRATIONS_DIR = new URL('../../db/migrations/', import.meta.url);
export const SEED_FILE = new URL('../../db/seeds/data.json', import.meta.url);

const ssl = () => (process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false);

/**
 * Crea la base `dbName` si no existe. Se conecta a la base de mantenimiento "postgres"
 * porque no se puede crear una base estando conectado a ella misma.
 * @returns {Promise<boolean>} true si la creó, false si ya existía.
 */
export async function ensureDatabase(dbName) {
  const client = new pg.Client({ database: 'postgres', ssl: ssl() });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rowCount) return false;
    await client.query(`CREATE DATABASE ${pg.escapeIdentifier(dbName)}`);
    return true;
  } finally {
    await client.end();
  }
}

/** Elimina la base `dbName` (solo para tests). */
export async function dropDatabase(dbName) {
  const client = new pg.Client({ database: 'postgres', ssl: ssl() });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS ${pg.escapeIdentifier(dbName)} WITH (FORCE)`);
  } finally {
    await client.end();
  }
}

/**
 * Aplica en orden los .sql de `dir` que aún no estén registrados en schema_migrations.
 * Cada migración corre en su propia transacción: si falla, se revierte y se detiene.
 * @returns {Promise<string[]>} nombres de las migraciones aplicadas en esta ejecución.
 */
export async function runMigrations(client, dir = MIGRATIONS_DIR) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  const { rows } = await client.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const done = [];

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(new URL(file, dir), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      done.push(file);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Falló la migración ${file}: ${err.message}`);
    }
  }
  return done;
}

export async function readSeedFile(file = SEED_FILE) {
  return JSON.parse(await readFile(file, 'utf8'));
}

/**
 * Carga los datos en una sola transacción (todo o nada) usando los repositorios (UPSERT: idempotente).
 * Valida todo el JSON con DTOs ANTES de abrir la transacción.
 * @returns {Promise<{players: number, sessions: number, playerSessions: number, thresholds: number, warnings: string[]}>}
 */
export async function seedDatabase(client, raw) {
  const data = parseSeedData(raw); // lanza ValidationError sin tocar la BD
  await client.query('BEGIN');
  try {
    await upsertTeam(data.team, client);
    for (const t of data.thresholds) await upsertThreshold(t, client);
    for (const p of data.players) await upsertPlayer(p, client);
    for (const s of data.sessions) await upsertSession(s, client);
    for (const ps of data.playerSessions) await upsertPlayerSession(ps, client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
  return {
    players: data.players.length,
    sessions: data.sessions.length,
    playerSessions: data.playerSessions.length,
    thresholds: data.thresholds.length,
    warnings: data.warnings,
  };
}
