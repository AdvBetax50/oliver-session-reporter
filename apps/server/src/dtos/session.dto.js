import { requireDate, requireEnum, requireInt, requireString } from './validation.js';

export const SESSION_TYPES = ['training', 'match'];

export class SessionDTO {
  constructor({ id, teamId, date, title, type, durationMin }) {
    this.id = id;
    this.teamId = teamId;
    this.date = date;
    this.title = title;
    this.type = type;
    this.durationMin = durationMin;
    Object.freeze(this);
  }

  static fromJson(raw, teamId) {
    const f = `sessions[id=${raw?.id}]`;
    return new SessionDTO({
      id: requireInt(raw?.id, `${f}.id`, { min: 1 }),
      teamId: requireInt(teamId, `${f}.teamId`, { min: 1 }),
      date: requireDate(raw?.date, `${f}.date`),
      title: requireString(raw?.title, `${f}.title`),
      type: requireEnum(raw?.type, `${f}.type`, SESSION_TYPES),
      durationMin: requireInt(raw?.duration_min, `${f}.duration_min`, { min: 1 }),
    });
  }

  static fromRow(row) {
    return new SessionDTO({
      id: row.id,
      teamId: row.team_id,
      date: row.date,
      title: row.title,
      type: row.type,
      durationMin: row.duration_min,
    });
  }

  toParams() {
    return [this.id, this.teamId, this.date, this.title, this.type, this.durationMin];
  }
}
