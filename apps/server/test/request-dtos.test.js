// DTOs de request (query/body/params) y mapeo fromRow de las entidades.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MetricsQueryDTO, ORDERABLE_FIELDS, PlayerDTO, ReportRequestDTO, SessionDTO, TeamDTO, ValidationError,
} from '../src/dtos/index.js';
import { parsePositiveInt } from '../src/dtos/validation.js';

test('parsePositiveInt: solo enteros positivos escritos como dígitos', () => {
  assert.equal(parsePositiveInt('103', 'id'), 103);
  for (const bad of ['0', '-1', '1.5', '1e3', 'abc', ' 7', '', undefined, '99999999999999999999']) {
    assert.throws(() => parsePositiveInt(bad, 'id'), ValidationError, String(bad));
  }
});

test('MetricsQueryDTO: valores por defecto (orden por dorsal ascendente, sin filtro)', () => {
  assert.deepEqual({ ...MetricsQueryDTO.fromRequest({ id: '103' }, {}) }, { sessionId: 103, playerId: null, orderBy: 'shirt_number', order: 'asc' });
});

test('MetricsQueryDTO: el orden por defecto es desc para métricas y asc para texto', () => {
  assert.equal(MetricsQueryDTO.fromRequest({ id: '1' }, { order_by: 'workload_au' }).order, 'desc');
  assert.equal(MetricsQueryDTO.fromRequest({ id: '1' }, { order_by: 'name' }).order, 'asc');
  assert.equal(MetricsQueryDTO.fromRequest({ id: '1' }, { order_by: 'position' }).order, 'asc');
  assert.equal(MetricsQueryDTO.fromRequest({ id: '1' }, { order_by: 'rpe', order: 'ASC' }).order, 'asc', 'acepta mayúsculas');
});

test('MetricsQueryDTO: acepta todos los campos de la lista blanca y rechaza el resto', () => {
  for (const field of ORDERABLE_FIELDS) assert.equal(MetricsQueryDTO.fromRequest({ id: '1' }, { order_by: field }).orderBy, field);
  assert.throws(() => MetricsQueryDTO.fromRequest({ id: '1' }, { order_by: 'player_id' }), ValidationError);
  assert.throws(() => MetricsQueryDTO.fromRequest({ id: '1' }, { order: 'up' }), ValidationError);
  assert.throws(() => MetricsQueryDTO.fromRequest({ id: '1' }, { player_id: 'x' }), ValidationError);
});

test('MetricsQueryDTO: un parámetro repetido (?order_by=a&order_by=b) se rechaza', () => {
  assert.throws(() => MetricsQueryDTO.fromRequest({ id: '1' }, { order_by: ['rpe', 'sprints'] }), /solo admite un valor/);
});

test('ReportRequestDTO: defaults es/coach; el body tiene prioridad sobre la query', () => {
  assert.deepEqual({ ...ReportRequestDTO.fromRequest({ id: '5' }) }, { sessionId: 5, language: 'es', audience: 'coach' });
  assert.deepEqual(
    { ...ReportRequestDTO.fromRequest({ id: '5' }, {}, { language: 'en', audience: 'player' }) },
    { sessionId: 5, language: 'en', audience: 'player' },
    'se acepta la query',
  );
  assert.equal(ReportRequestDTO.fromRequest({ id: '5' }, { language: 'es' }, { language: 'en' }).language, 'es');
  assert.throws(() => ReportRequestDTO.fromRequest({ id: '5' }, { language: 'pt' }), ValidationError);
  assert.throws(() => ReportRequestDTO.fromRequest({ id: '5' }, { audience: 'fans' }), ValidationError);
  assert.throws(() => ReportRequestDTO.fromRequest({ id: 'abc' }), ValidationError);
});

test('fromRow: Team, Player y Session mapean snake_case -> camelCase y son inmutables', () => {
  const team = TeamDTO.fromRow({ id: 42, name: 'X', sport: 'football' });
  const player = PlayerDTO.fromRow({ id: 1, team_id: 42, name: 'A B', position: 'GK', shirt_number: 1 });
  const session = SessionDTO.fromRow({ id: 101, team_id: 42, date: '2026-09-15', title: 'T', type: 'training', duration_min: 75 });
  assert.deepEqual({ ...team }, { id: 42, name: 'X', sport: 'football' });
  assert.deepEqual({ ...player }, { id: 1, teamId: 42, name: 'A B', position: 'GK', shirtNumber: 1 });
  assert.deepEqual({ ...session }, { id: 101, teamId: 42, date: '2026-09-15', title: 'T', type: 'training', durationMin: 75 });
  assert.ok(Object.isFrozen(player));
  assert.deepEqual(player.toParams(), [1, 42, 'A B', 'GK', 1]);
  assert.deepEqual(session.toParams(), [101, 42, '2026-09-15', 'T', 'training', 75]);
});

test('fromJson: normaliza espacios y valida rangos de dorsal y fecha', () => {
  assert.equal(TeamDTO.fromJson({ id: 1, name: '  Equipo  ', sport: 'football' }).name, 'Equipo');
  assert.throws(() => PlayerDTO.fromJson({ id: 1, name: 'A', position: 'GK', shirt_number: 100 }, 1), ValidationError);
  assert.throws(() => SessionDTO.fromJson({ id: 1, date: '2026-13-45', title: 'T', type: 'match', duration_min: 90 }, 1), ValidationError);
  assert.throws(() => SessionDTO.fromJson({ id: 1, date: '2026-09-15', title: 'T', type: 'match', duration_min: 0 }, 1), ValidationError);
});
