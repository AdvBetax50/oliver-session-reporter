import { describe, expect, test } from 'vitest';
import { defaultOrderFor, formatDate, formatValue, indexBreaches, METRICS, METRICS_BY_KEY, withUnit } from './metrics.js';

describe('metrics.js', () => {
  test('cada métrica tiene key de la API, campo camelCase, etiquetas y descripción para la leyenda', () => {
    expect(METRICS.map((m) => m.key)).toEqual([
      'minutes_played', 'total_distance_m', 'high_speed_running_m', 'sprints', 'max_speed_kmh', 'accelerations', 'rpe', 'workload_au',
    ]);
    for (const m of METRICS) {
      expect(m.field).toMatch(/^[a-z][A-Za-z]+$/);
      expect(m.label && m.short && m.description).toBeTruthy();
    }
    expect(METRICS_BY_KEY.workload_au.description).toMatch(/RPE × minutes played/);
  });

  test('formatValue: separador de miles, decimales por métrica y guion para valores ausentes', () => {
    expect(formatValue(10488, METRICS_BY_KEY.total_distance_m)).toBe('10,488');
    expect(formatValue(29.6, METRICS_BY_KEY.max_speed_kmh)).toBe('29.6');
    expect(formatValue(30, METRICS_BY_KEY.max_speed_kmh)).toBe('30.0');
    expect(formatValue(null, METRICS_BY_KEY.rpe)).toBe('—');
    expect(formatValue(undefined)).toBe('—');
  });

  test('withUnit: añade la unidad o indica "not reported"', () => {
    expect(withUnit(810, METRICS_BY_KEY.workload_au)).toBe('810 AU');
    expect(withUnit(21, METRICS_BY_KEY.sprints)).toBe('21');
    expect(withUnit(null, METRICS_BY_KEY.rpe)).toBe('not reported');
  });

  test('formatDate: interpreta YYYY-MM-DD en UTC (no se corre el día por la zona horaria)', () => {
    expect(formatDate('2026-09-19')).toBe('Sep 19, 2026');
    expect(formatDate('2026-01-01')).toBe('Jan 1, 2026');
  });

  test('defaultOrderFor: desc para métricas, asc para dorsal/nombre/posición (igual que la API)', () => {
    expect(defaultOrderFor('workload_au')).toBe('desc');
    expect(defaultOrderFor('shirt_number')).toBe('asc');
    expect(defaultOrderFor('name')).toBe('asc');
    expect(defaultOrderFor('position')).toBe('asc');
  });

  test('indexBreaches: índice "jugador:métrica" a partir de las alertas del servidor', () => {
    const map = indexBreaches([{ playerId: 5, breaches: [{ metric: 'rpe', level: 'warning' }, { metric: 'workload_au', level: 'critical' }] }]);
    expect(map.get('5:workload_au').level).toBe('critical');
    expect(map.get('5:sprints')).toBeUndefined();
    expect(indexBreaches(undefined).size).toBe(0);
  });
});
