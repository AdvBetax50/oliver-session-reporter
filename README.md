# Oliver

Monorepo con **React + Vite** (frontend), **Node.js + Express** (API) y **PostgreSQL** (base de datos `oliver`).

> El registro de decisiones tomadas durante el desarrollo está en [`log.md`](./log.md).

## Estructura

```
oliver/
├── apps/
│   ├── client/            # React + Vite + Tailwind + Recharts (UI en inglés)
│   │   ├── src/
│   │   │   ├── components/  # SessionSelector, MetricsTable, MetricChart, ReportPanel, ui
│   │   │   ├── hooks/       # useAsync (fetch con cancelación)
│   │   │   ├── api.js       # cliente HTTP
│   │   │   └── metrics.js   # definición y formato de métricas
│   │   └── vite.config.js # proxy /api -> http://localhost:3001
│   └── server/            # Express + pg
│       ├── src/
│       │   ├── app.js         # configuración de Express
│       │   ├── index.js       # arranque del servidor
│       │   ├── db/            # pool PostgreSQL + parser del JSON de seed
│       │   ├── dtos/          # DTOs: validación (fromJson) y mapeo (fromRow / toParams)
│       │   ├── repositories/  # acceso a datos (SQL) que recibe y devuelve DTOs
│       │   ├── ai/            # capa de IA intercambiable (gemini | mock)
│       │   ├── services/      # lógica de negocio: sesiones, alertas, reporte
│       │   └── routes/        # HTTP <-> servicios
│       ├── test/              # tests con node:test
│       ├── prompts/           # prompts versionados (session-report.v1.md)
│       ├── db/
│       │   ├── migrations/  # archivos .sql numerados
│       │   └── seeds/       # data.json con los datos iniciales
│       └── scripts/         # create-db, migrate, seed
├── log.md
└── package.json           # npm workspaces
```

## Requisitos

- Node.js >= 20.19 (probado con 22)
- PostgreSQL en ejecución (probado con 18)

## Puesta en marcha

```bash
npm install

# Configurar PostgreSQL y Gemini
cp apps/server/.env.example apps/server/.env   # editar PGUSER / PGPASSWORD / GEMINI_API_KEY

# Crear la base "oliver", aplicar migraciones y cargar datos
npm run db:setup

# Levantar API (3001) y cliente (5173) a la vez
npm run dev
```

Abrir http://localhost:5173.

## Frontend

- **Selector de sesión** (por defecto, la más reciente).
- **Tabla de métricas** ordenable por cualquier columna (el orden lo resuelve la API). Los valores que alcanzan un umbral se resaltan: ▲ ámbar = warning, ▲▲ rojo = critical.
- **Gráfico de barras** por jugador para la métrica elegida, con líneas de umbral.
- **Reporte con IA**: idioma (English / Español) y audiencia (Coach / Players), con estados vacío, carga, error y resultado.

> Sin API key de Gemini, el reporte se puede probar con `AI_PROVIDER=mock`: devuelve un texto de ejemplo.

## Modelo de datos

```
teams 1──N players
teams 1──N sessions
teams 1──N metric_thresholds
players N──M sessions  (vía player_sessions: métricas del jugador en la sesión)
```

`player_sessions.workload_au` es una columna generada (`rpe * minutes_played`); es `NULL` si falta el RPE.

## Gemini API

La clave se obtiene en https://aistudio.google.com/apikey y se guarda en `apps/server/.env` (`GEMINI_API_KEY`). Solo la usa el servidor; nunca se expone al navegador.

El proveedor de IA es intercambiable: se elige con `AI_PROVIDER` (`gemini` | `mock`). Para añadir otro, basta con extender `AiProvider` en `src/ai/providers/` y registrarlo en `src/ai/index.js`.

### Garantías del reporte

- **Sin datos inventados:** salida estructurada (JSON Schema con los `player_id` reales como `enum`) y validación posterior de cada número y nombre del texto. Si algo no está en los datos, se reintenta una vez indicando el problema y, si persiste, ese campo se reemplaza por texto generado desde los datos verificados (marcado `fallback`).
- **Contexto calculado en el código:** alertas de umbral, promedios, rankings y excesos sobre el umbral se calculan antes de llamar al modelo.
- **Datos incompletos:** RPE `null` (no se supone ningún valor ni se evalúan alertas sobre él) y jugadores con menos del 50 % de los minutos (se comparan solo por minuto y quedan fuera de los promedios).
- **Errores:** timeout → 504, rate limit → 429 con `Retry-After` (con reintento si la espera es corta), respuesta inválida → reintento + respaldo.
- **Prompt versionado:** [`apps/server/prompts/session-report.v1.md`](apps/server/prompts/session-report.v1.md). La versión se elige con `REPORT_PROMPT_VERSION` y se devuelve en `meta.promptVersion`. Ver el paso a paso en [`log.md`](./log.md#paso-a-paso-crear-la-api-key-de-gemini).

## Scripts (desde la raíz)

| Script | Descripción |
| --- | --- |
| `npm run dev` | API + cliente en paralelo |
| `npm run dev:server` / `dev:client` | Cada app por separado |
| `npm run build` | Build de producción del cliente |
| `npm test` | Tests del servidor (DTOs, capa de IA y API sin necesidad de BD) |
| `npm run db:create` | Crea la base `oliver` si no existe |
| `npm run db:migrate` | Aplica migraciones pendientes |
| `npm run db:seed` | Carga `apps/server/db/seeds/data.json` |
| `npm run db:setup` | Las tres anteriores en orden |

## API

Servidor en `http://localhost:3001` (desde el cliente se accede como `/api/...` gracias al proxy de Vite).

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/health` | Estado de la API y conexión a la base de datos |
| GET | `/sessions` | Lista de sesiones: `id`, `date`, `title`, `type` |
| GET | `/sessions/:id/metrics` | Métricas de los jugadores de la sesión, umbrales y alertas |
| POST | `/sessions/:id/report` | Reporte generado por IA: resumen, destacados y alertas |

### `GET /sessions/:id/metrics`

| Query | Valores | Por defecto |
| --- | --- | --- |
| `player_id` | id de jugador | todos |
| `order_by` | `shirt_number`, `name`, `position`, `minutes_played`, `total_distance_m`, `high_speed_running_m`, `sprints`, `max_speed_kmh`, `accelerations`, `rpe`, `workload_au` | `shirt_number` |
| `order` | `asc`, `desc` | `desc` para métricas, `asc` para dorsal/nombre/posición |

Los valores nulos (RPE no reportado) quedan siempre al final.

```bash
curl "http://localhost:3001/sessions/103/metrics?order_by=total_distance_m&order=desc"
curl "http://localhost:3001/sessions/103/metrics?player_id=5"
```

### `POST /sessions/:id/report`

Body JSON (o query string): `language` = `es` | `en` (por defecto `es`), `audience` = `coach` | `player` (por defecto `coach`).

```bash
curl -X POST http://localhost:3001/sessions/103/report \
  -H "Content-Type: application/json" \
  -d '{"language":"es","audience":"coach"}'
```

Respuesta:

```jsonc
{
  "session": { "id": 103, "date": "2026-09-19", "title": "...", "type": "match" },
  "language": "es",
  "audience": "coach",
  "report": {
    "summary": "...", "summarySource": "ai",             // "fallback" si se reemplazó por texto verificado
    "highlights": [{ "playerId": 5, "name": "Santiago Molina", "reason": "...", "source": "ai" }],
    "alerts": [{
      "playerId": 5, "name": "Santiago Molina", "level": "critical",
      "breaches": [{ "metric": "workload_au", "value": 810, "level": "critical", "warning": 600, "critical": 750, "threshold": 750, "excess": 60 }],
      "comment": "...", "commentSource": "ai"
    }]
  },
  "dataQuality": {
    "playersWithoutRpe": [{ "playerId": 9, "name": "Mateo Suárez" }],
    "lowMinutesPlayers": [{ "playerId": 11, "name": "Franco Medina", "minutesPlayed": 28 }]
  },
  "meta": {
    "provider": "gemini", "model": "...", "promptVersion": "session-report.v1", "attempts": 1,
    "usage": { "inputTokens": 0, "outputTokens": 0 },
    "validation": { "passed": true, "issues": [{ "attempt": 1, "issues": [] }], "fallbackFields": [] },
    "generatedAt": "..."
  }
}
```

Errores: `400` parámetros inválidos, `404` sesión inexistente, `502`/`504`/`429` fallo, timeout o límite del proveedor de IA.
