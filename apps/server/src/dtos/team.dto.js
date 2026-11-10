import { requireInt, requireString } from './validation.js';

export class TeamDTO {
  constructor({ id, name, sport }) {
    this.id = id;
    this.name = name;
    this.sport = sport;
    Object.freeze(this);
  }

  static fromJson(raw) {
    return new TeamDTO({
      id: requireInt(raw?.id, 'team.id', { min: 1 }),
      name: requireString(raw?.name, 'team.name'),
      sport: requireString(raw?.sport, 'team.sport'),
    });
  }

  static fromRow(row) {
    return new TeamDTO({ id: row.id, name: row.name, sport: row.sport });
  }

  toParams() {
    return [this.id, this.name, this.sport];
  }
}
