// Evaluación de umbrales (services/alerts.js): bordes, valores nulos, niveles y orden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAlerts, levelFor, thresholdsToMap } from '../src/services/alerts.js';
import { ThresholdDTO } from '../src/dtos/index.js';

const workload = { warning: 600, critical: 750 };
const sprints = { warning: 28, critical: null };

test('levelFor: el umbral se alcanza con >= (no con >)', () => {
  assert.equal(levelFor(599, workload), null);
  assert.equal(levelFor(600, workload), 'warning');
  assert.equal(levelFor(749, workload), 'warning');
  assert.equal(levelFor(750, workload), 'critical');
  assert.equal(levelFor(28, sprints), 'warning');
  assert.equal(levelFor(1000, sprints), 'warning', 'sin critical nunca es critical');
});

test('levelFor: un valor ausente (null/undefined) nunca genera alerta', () => {
  assert.equal(levelFor(null, workload), null);
  assert.equal(levelFor(undefined, workload), null);
});

const thresholds = [
  new ThresholdDTO({ teamId: 1, metric: 'workload_au', warning: 600, critical: 750 }),
  new ThresholdDTO({ teamId: 1, metric: 'sprints', warning: 28, critical: null }),
  new ThresholdDTO({ teamId: 1, metric: 'rpe', warning: 8, critical: null }),
];
const row = (playerId, name, values) => ({ playerId, player: { name }, workloadAu: null, sprints: 0, rpe: null, ...values });

test('evaluateAlerts: agrupa por jugador, mapea snake_case -> camelCase y ordena críticos primero', () => {
  const alerts = evaluateAlerts(
    [
      row(1, 'A', { workloadAu: 610 }), // 1 warning
      row(2, 'B', { workloadAu: 800, sprints: 30, rpe: 9 }), // critical + 2 warnings
      row(3, 'C', { workloadAu: 100, sprints: 5, rpe: 3 }), // sin alertas
      row(4, 'D', { workloadAu: 620, sprints: 29, rpe: 8 }), // 3 warnings
      row(5, 'E', { workloadAu: null, rpe: null, sprints: 1 }), // RPE no reportado
    ],
    thresholds,
  );
  assert.deepEqual(alerts.map((a) => [a.playerId, a.level, a.breaches.length]), [[2, 'critical', 3], [4, 'warning', 3], [1, 'warning', 1]]);
  assert.deepEqual(alerts[0].breaches[0], { metric: 'workload_au', value: 800, warning: 600, critical: 750, level: 'critical' });
  assert.equal(alerts[0].name, 'B');
});

test('evaluateAlerts: sin umbrales o sin métricas devuelve []', () => {
  assert.deepEqual(evaluateAlerts([row(1, 'A', { workloadAu: 999 })], []), []);
  assert.deepEqual(evaluateAlerts([], thresholds), []);
});

test('thresholdsToMap: formato { metric: { warning, critical } } para la UI', () => {
  assert.deepEqual(thresholdsToMap(thresholds), {
    workload_au: { warning: 600, critical: 750 },
    sprints: { warning: 28, critical: null },
    rpe: { warning: 8, critical: null },
  });
});
