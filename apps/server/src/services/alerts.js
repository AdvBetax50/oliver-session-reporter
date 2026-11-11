// Evaluación de umbrales. Es lógica determinista: las alertas las calcula el código,
// no el modelo de IA, para que nunca se omitan ni se inventen.

const snakeToCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

/**
 * Nivel de una métrica respecto a su umbral. Se considera superado al ALCANZAR el valor
 * (>=): p. ej. un RPE de 8 con warning 8 ya es una señal de esfuerzo alto.
 * @returns {'critical'|'warning'|null}
 */
export function levelFor(value, { warning, critical }) {
  if (value === null || value === undefined) return null; // dato ausente: no se evalúa
  if (critical !== null && critical !== undefined && value >= critical) return 'critical';
  if (value >= warning) return 'warning';
  return null;
}

/**
 * @param {import('../dtos/index.js').PlayerSessionDTO[]} metrics
 * @param {import('../dtos/index.js').ThresholdDTO[]} thresholds
 * @returns {{playerId:number, name:string|null, level:'critical'|'warning',
 *   breaches:{metric:string, value:number, warning:number, critical:number|null, level:string}[]}[]}
 */
export function evaluateAlerts(metrics, thresholds) {
  const alerts = [];
  for (const m of metrics) {
    const breaches = [];
    for (const t of thresholds) {
      const value = m[snakeToCamel(t.metric)];
      const level = levelFor(value, t);
      if (level) breaches.push({ metric: t.metric, value, warning: t.warning, critical: t.critical, level });
    }
    if (breaches.length) {
      alerts.push({
        playerId: m.playerId,
        name: m.player?.name ?? null,
        level: breaches.some((b) => b.level === 'critical') ? 'critical' : 'warning',
        breaches,
      });
    }
  }
  // Primero los críticos, después los que superan más umbrales.
  return alerts.sort((a, b) =>
    (a.level === b.level ? 0 : a.level === 'critical' ? -1 : 1) || b.breaches.length - a.breaches.length,
  );
}

// [{metric, warning, critical}] -> { metric: { warning, critical } } (formato cómodo para la UI)
export function thresholdsToMap(thresholds) {
  return Object.fromEntries(thresholds.map((t) => [t.metric, { warning: t.warning, critical: t.critical }]));
}
