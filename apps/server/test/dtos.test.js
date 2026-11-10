import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseSeedData } from '../src/db/parse-seed-data.js';
import { PlayerDTO, PlayerSessionDTO, SessionDTO, ThresholdDTO, ValidationError } from '../src/dtos/index.js';

const raw = JSON.parse(await readFile(new URL('../db/seeds/data.json', import.meta.url), 'utf8'));

test('el JSON de ejemplo se convierte completo en DTOs válidos y consistentes', () => {
  const data = parseSeedData(raw);
  assert.equal(data.team.id, 42);
  assert.equal(data.players.length, 12);
  assert.equal(data.sessions.length, 3);
  assert.equal(data.playerSessions.length, 36);
  assert.equal(data.thresholds.length, 4);
  assert.deepEqual(data.warnings, []);
});

test('RPE ausente produce rpe y workloadAu null', () => {
  const { dto } = PlayerSessionDTO.fromJson(
    { player_id: 9, minutes_played: 90, total_distance_m: 6262, high_speed_running_m: 517, sprints: 10,
      max_speed_kmh: 29.4, accelerations: 30, rpe: null, workload_au: null },
    103,
  );
  assert.equal(dto.rpe, null);
  assert.equal(dto.workloadAu, null);
});

test('valores inválidos lanzan ValidationError', () => {
  assert.throws(() => PlayerDTO.fromJson({ id: 1, name: 'X', position: 'ST', shirt_number: 9 }, 42), ValidationError);
  assert.throws(() => SessionDTO.fromJson({ id: 1, date: '15/09/2026', title: 'X', type: 'training', duration_min: 75 }, 42), ValidationError);
  assert.throws(() => ThresholdDTO.fromJson('workload_au', { warning: 700, critical: 600 }, 42), ValidationError);
  const bad = structuredClone(raw);
  bad.sessions[0].player_sessions[0].rpe = 11;
  assert.throws(() => parseSeedData(bad), ValidationError);
});

test('referencias a jugadores inexistentes se rechazan', () => {
  const bad = structuredClone(raw);
  bad.sessions[0].player_sessions[0].player_id = 999;
  assert.throws(() => parseSeedData(bad), /inexistente 999/);
});

test('fromRow mapea snake_case a camelCase y convierte NUMERIC', () => {
  const dto = PlayerSessionDTO.fromRow({
    session_id: 103, player_id: 5, minutes_played: 90, total_distance_m: 10488, high_speed_running_m: 798,
    sprints: 21, max_speed_kmh: '29.6', accelerations: 58, rpe: 9, workload_au: 810,
    player_name: 'Santiago Molina', player_position: 'MF', player_shirt_number: 6,
  });
  assert.equal(dto.maxSpeedKmh, 29.6);
  assert.equal(dto.totalDistanceM, 10488);
  assert.deepEqual(dto.player, { name: 'Santiago Molina', position: 'MF', shirtNumber: 6 });

  const t = ThresholdDTO.fromRow({ team_id: 42, metric: 'sprints', warning: '28', critical: null });
  assert.deepEqual({ ...t }, { teamId: 42, metric: 'sprints', warning: 28, critical: null });
});

test('toParams excluye workload_au (columna generada)', () => {
  const { dto } = PlayerSessionDTO.fromJson(raw.sessions[0].player_sessions[0], 101);
  assert.equal(dto.toParams().length, 9);
});
