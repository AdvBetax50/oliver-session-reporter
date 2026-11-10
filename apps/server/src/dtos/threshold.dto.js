import { optionalNumber, requireInt, requireNumber, requireString, toNumberOrNull, ValidationError } from './validation.js';

// Umbral de referencia de una métrica (warning obligatorio, critical opcional).
export class ThresholdDTO {
  constructor({ teamId, metric, warning, critical }) {
    this.teamId = teamId;
    this.metric = metric;
    this.warning = warning;
    this.critical = critical;
    Object.freeze(this);
  }

  // En el JSON los umbrales vienen como objeto { metric: { warning, critical? } }
  static fromJson(metric, raw, teamId) {
    const f = `thresholds.${metric}`;
    const warning = requireNumber(raw?.warning, `${f}.warning`, { min: 0 });
    const critical = optionalNumber(raw?.critical, `${f}.critical`, { min: 0 });
    if (critical !== null && critical <= warning) {
      throw new ValidationError(`${f}.critical (${critical}) debe ser mayor que warning (${warning})`);
    }
    return new ThresholdDTO({
      teamId: requireInt(teamId, `${f}.teamId`, { min: 1 }),
      metric: requireString(metric, `${f}`),
      warning,
      critical,
    });
  }

  static fromRow(row) {
    return new ThresholdDTO({
      teamId: row.team_id,
      metric: row.metric,
      warning: toNumberOrNull(row.warning),
      critical: toNumberOrNull(row.critical),
    });
  }

  toParams() {
    return [this.teamId, this.metric, this.warning, this.critical];
  }
}
