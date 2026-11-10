import { optionalInt, requireInt, requireNumber, toNumberOrNull } from './validation.js';

// Métricas de un jugador en una sesión.
export class PlayerSessionDTO {
  constructor({
    sessionId, playerId, minutesPlayed, totalDistanceM, highSpeedRunningM,
    sprints, maxSpeedKmh, accelerations, rpe, workloadAu, player = null,
  }) {
    this.sessionId = sessionId;
    this.playerId = playerId;
    this.minutesPlayed = minutesPlayed;
    this.totalDistanceM = totalDistanceM;
    this.highSpeedRunningM = highSpeedRunningM;
    this.sprints = sprints;
    this.maxSpeedKmh = maxSpeedKmh;
    this.accelerations = accelerations;
    this.rpe = rpe; // null = el jugador no reportó RPE
    this.workloadAu = workloadAu; // rpe * minutes_played (null si falta el RPE)
    if (player) this.player = player; // datos del jugador cuando la consulta hace JOIN
    Object.freeze(this);
  }

  static computeWorkload(rpe, minutesPlayed) {
    return rpe === null ? null : rpe * minutesPlayed;
  }

  // workload_au del JSON no se usa como fuente: se recalcula (la BD lo genera igual).
  // `sourceWorkloadAu` se expone solo para poder detectar inconsistencias en el origen.
  static fromJson(raw, sessionId) {
    const f = `sessions[id=${sessionId}].player_sessions[player_id=${raw?.player_id}]`;
    const minutesPlayed = requireInt(raw?.minutes_played, `${f}.minutes_played`, { min: 0 });
    const rpe = optionalInt(raw?.rpe, `${f}.rpe`, { min: 1, max: 10 });
    const dto = new PlayerSessionDTO({
      sessionId: requireInt(sessionId, `${f}.session_id`, { min: 1 }),
      playerId: requireInt(raw?.player_id, `${f}.player_id`, { min: 1 }),
      minutesPlayed,
      totalDistanceM: requireInt(raw?.total_distance_m, `${f}.total_distance_m`, { min: 0 }),
      highSpeedRunningM: requireInt(raw?.high_speed_running_m, `${f}.high_speed_running_m`, { min: 0 }),
      sprints: requireInt(raw?.sprints, `${f}.sprints`, { min: 0 }),
      maxSpeedKmh: requireNumber(raw?.max_speed_kmh, `${f}.max_speed_kmh`, { min: 0 }),
      accelerations: requireInt(raw?.accelerations, `${f}.accelerations`, { min: 0 }),
      rpe,
      workloadAu: PlayerSessionDTO.computeWorkload(rpe, minutesPlayed),
    });
    return { dto, sourceWorkloadAu: raw?.workload_au ?? null };
  }

  static fromRow(row) {
    return new PlayerSessionDTO({
      sessionId: row.session_id,
      playerId: row.player_id,
      minutesPlayed: row.minutes_played,
      totalDistanceM: row.total_distance_m,
      highSpeedRunningM: row.high_speed_running_m,
      sprints: row.sprints,
      maxSpeedKmh: toNumberOrNull(row.max_speed_kmh),
      accelerations: row.accelerations,
      rpe: row.rpe,
      workloadAu: row.workload_au,
      player: row.player_name === undefined ? null : {
        name: row.player_name,
        position: row.player_position,
        shirtNumber: row.player_shirt_number,
      },
    });
  }

  // workload_au no se incluye: es una columna generada por la BD.
  toParams() {
    return [
      this.sessionId, this.playerId, this.minutesPlayed, this.totalDistanceM, this.highSpeedRunningM,
      this.sprints, this.maxSpeedKmh, this.accelerations, this.rpe,
    ];
  }
}
