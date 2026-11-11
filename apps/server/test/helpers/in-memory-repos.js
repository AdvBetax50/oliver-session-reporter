// Repositorios en memoria con la misma interfaz que los de PostgreSQL,
// alimentados con el JSON de ejemplo. Permiten testear la API sin base de datos.
import { readFileSync } from 'node:fs';
import { parseSeedData } from '../../src/db/parse-seed-data.js';
import { PlayerSessionDTO } from '../../src/dtos/index.js';

export const rawSeed = JSON.parse(readFileSync(new URL('../../db/seeds/data.json', import.meta.url), 'utf8'));

const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const PLAYER_FIELDS = { shirt_number: 'shirtNumber', name: 'name', position: 'position' };

export function createInMemoryRepos(raw = rawSeed) {
  const data = parseSeedData(raw);
  const players = new Map(data.players.map((p) => [p.id, p]));
  const withPlayer = (ps) => {
    const p = players.get(ps.playerId);
    return new PlayerSessionDTO({ ...ps, player: { name: p.name, position: p.position, shirtNumber: p.shirtNumber } });
  };

  return {
    async findAllSessions() {
      return [...data.sessions].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    },
    async findSessionById(id) {
      return data.sessions.find((s) => s.id === id) ?? null;
    },
    async findThresholdsByTeam(teamId) {
      return data.thresholds.filter((t) => t.teamId === teamId);
    },
    async findMetricsBySession(sessionId, { playerId = null, orderBy = 'shirt_number', order = 'asc' } = {}) {
      const get = PLAYER_FIELDS[orderBy] ? (r) => r.player[PLAYER_FIELDS[orderBy]] : (r) => r[camel(orderBy)];
      const dir = order === 'desc' ? -1 : 1;
      return data.playerSessions
        .filter((ps) => ps.sessionId === sessionId && (playerId === null || ps.playerId === playerId))
        .map(withPlayer)
        .sort((a, b) => {
          const va = get(a);
          const vb = get(b);
          if (va === null || vb === null) return (va === null) - (vb === null); // NULLS LAST
          return (va < vb ? -1 : va > vb ? 1 : 0) * dir || a.player.shirtNumber - b.player.shirtNumber;
        });
    },
  };
}
