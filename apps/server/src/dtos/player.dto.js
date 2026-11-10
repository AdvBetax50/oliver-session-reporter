import { requireEnum, requireInt, requireString } from './validation.js';

export const POSITIONS = ['GK', 'DF', 'MF', 'FW'];

export class PlayerDTO {
  constructor({ id, teamId, name, position, shirtNumber }) {
    this.id = id;
    this.teamId = teamId;
    this.name = name;
    this.position = position;
    this.shirtNumber = shirtNumber;
    Object.freeze(this);
  }

  static fromJson(raw, teamId) {
    const f = `players[id=${raw?.id}]`;
    return new PlayerDTO({
      id: requireInt(raw?.id, `${f}.id`, { min: 1 }),
      teamId: requireInt(teamId, `${f}.teamId`, { min: 1 }),
      name: requireString(raw?.name, `${f}.name`),
      position: requireEnum(raw?.position, `${f}.position`, POSITIONS),
      shirtNumber: requireInt(raw?.shirt_number, `${f}.shirt_number`, { min: 1, max: 99 }),
    });
  }

  static fromRow(row) {
    return new PlayerDTO({
      id: row.id,
      teamId: row.team_id,
      name: row.name,
      position: row.position,
      shirtNumber: row.shirt_number,
    });
  }

  toParams() {
    return [this.id, this.teamId, this.name, this.position, this.shirtNumber];
  }
}
