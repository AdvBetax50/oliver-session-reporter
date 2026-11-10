-- Esquema inicial a partir de session_data.json
-- Unidades: metros (m), km/h, minutos. RPE escala 1-10 (puede ser NULL).

CREATE TABLE teams (
  id     INTEGER PRIMARY KEY,
  name   TEXT NOT NULL,
  sport  TEXT NOT NULL
);

CREATE TABLE players (
  id            INTEGER PRIMARY KEY,
  team_id       INTEGER NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  position      TEXT NOT NULL CHECK (position IN ('GK', 'DF', 'MF', 'FW')),
  shirt_number  SMALLINT NOT NULL CHECK (shirt_number > 0),
  UNIQUE (team_id, shirt_number)
);

CREATE TABLE sessions (
  id            INTEGER PRIMARY KEY,
  team_id       INTEGER NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  title         TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('training', 'match')),
  duration_min  SMALLINT NOT NULL CHECK (duration_min > 0)
);

-- Métricas de un jugador en una sesión (tabla puente N:M players <-> sessions)
CREATE TABLE player_sessions (
  session_id            INTEGER NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  player_id             INTEGER NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  minutes_played        SMALLINT NOT NULL CHECK (minutes_played >= 0),
  total_distance_m      INTEGER NOT NULL CHECK (total_distance_m >= 0),
  high_speed_running_m  INTEGER NOT NULL CHECK (high_speed_running_m >= 0),
  sprints               SMALLINT NOT NULL CHECK (sprints >= 0),
  max_speed_kmh         NUMERIC(4, 1) NOT NULL CHECK (max_speed_kmh >= 0),
  accelerations         SMALLINT NOT NULL CHECK (accelerations >= 0),
  rpe                   SMALLINT CHECK (rpe BETWEEN 1 AND 10),
  -- Derivado: rpe * minutos. Si falta el RPE queda NULL automáticamente.
  workload_au           INTEGER GENERATED ALWAYS AS (rpe * minutes_played) STORED,
  PRIMARY KEY (session_id, player_id)
);

-- Umbrales de referencia por equipo y métrica
CREATE TABLE metric_thresholds (
  team_id   INTEGER NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  metric    TEXT NOT NULL,
  warning   NUMERIC NOT NULL,
  critical  NUMERIC,
  PRIMARY KEY (team_id, metric),
  CHECK (critical IS NULL OR critical > warning)
);

CREATE INDEX idx_players_team ON players (team_id);
CREATE INDEX idx_sessions_team_date ON sessions (team_id, date DESC);
CREATE INDEX idx_player_sessions_player ON player_sessions (player_id);
