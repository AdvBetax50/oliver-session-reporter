# Oliver

Monorepo con **React + Vite** (frontend), **Node.js + Express** (API) y **PostgreSQL** (base de datos `oliver`).

> El registro de decisiones tomadas durante el desarrollo está en [`log.md`](./log.md).

## Estructura

```
oliver/
├── apps/
│   ├── client/            # React + Vite
│   │   ├── src/
│   │   └── vite.config.js # proxy /api -> http://localhost:3001
│   └── server/            # Express + pg
│       ├── src/
│       │   ├── app.js         # configuración de Express
│       │   ├── index.js       # arranque del servidor
│       │   ├── db/            # pool PostgreSQL + parser del JSON de seed
│       │   ├── dtos/          # DTOs: validación (fromJson) y mapeo (fromRow / toParams)
│       │   ├── repositories/  # acceso a datos (SQL) que recibe y devuelve DTOs
│       │   ├── ai/            # capa de IA intercambiable (gemini | mock)
│       │   └── routes/
│       ├── test/              # tests con node:test
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

El proveedor de IA es intercambiable: se elige con `AI_PROVIDER` (`gemini` | `mock`). Para añadir otro, basta con extender `AiProvider` en `src/ai/providers/` y registrarlo en `src/ai/index.js`. Ver el paso a paso en [`log.md`](./log.md#paso-a-paso-crear-la-api-key-de-gemini).

## Scripts (desde la raíz)

| Script | Descripción |
| --- | --- |
| `npm run dev` | API + cliente en paralelo |
| `npm run dev:server` / `dev:client` | Cada app por separado |
| `npm run build` | Build de producción del cliente |
| `npm test` | Tests del servidor (DTOs y capa de IA) |
| `npm run db:create` | Crea la base `oliver` si no existe |
| `npm run db:migrate` | Aplica migraciones pendientes |
| `npm run db:seed` | Carga `apps/server/db/seeds/data.json` |
| `npm run db:setup` | Las tres anteriores en orden |

## API

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/health` | Estado de la API y conexión a la base de datos |
