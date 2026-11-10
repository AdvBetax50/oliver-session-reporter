import { PlayerDTO, PlayerSessionDTO, SessionDTO, TeamDTO, ThresholdDTO, ValidationError } from '../dtos/index.js';

// Convierte el JSON crudo en DTOs validados. Lanza ValidationError ante el primer dato inválido.
// No toca la base de datos: así se valida todo el archivo antes de abrir la transacción.
export function parseSeedData(raw) {
  const team = TeamDTO.fromJson(raw?.team);

  const thresholds = Object.entries(raw?.thresholds ?? {}).map(([metric, value]) =>
    ThresholdDTO.fromJson(metric, value, team.id),
  );

  const players = (raw?.players ?? []).map((p) => PlayerDTO.fromJson(p, team.id));
  const playerIds = new Set(players.map((p) => p.id));

  const sessions = [];
  const playerSessions = [];
  const warnings = [];

  for (const s of raw?.sessions ?? []) {
    const session = SessionDTO.fromJson(s, team.id);
    sessions.push(session);

    for (const ps of s.player_sessions ?? []) {
      const { dto, sourceWorkloadAu } = PlayerSessionDTO.fromJson(ps, session.id);
      if (!playerIds.has(dto.playerId)) {
        throw new ValidationError(`La sesión ${session.id} referencia al jugador inexistente ${dto.playerId}`);
      }
      if (dto.minutesPlayed > session.durationMin) {
        throw new ValidationError(`Jugador ${dto.playerId} jugó ${dto.minutesPlayed} min en una sesión de ${session.durationMin} min (sesión ${session.id})`);
      }
      if (sourceWorkloadAu !== dto.workloadAu) {
        warnings.push(`workload_au inconsistente (sesión ${session.id}, jugador ${dto.playerId}): JSON=${sourceWorkloadAu}, calculado=${dto.workloadAu}`);
      }
      playerSessions.push(dto);
    }
  }

  return { team, thresholds, players, sessions, playerSessions, warnings };
}
