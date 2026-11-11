# Oliver · Session review

Herramienta para que un entrenador revise rápidamente cómo le fue a su equipo en una sesión (entrenamiento o partido):

- **Métricas por jugador** en una tabla ordenable y en un gráfico de barras con la métrica a elegir.
- **Resaltado de los valores que superan los umbrales** de carga (warning / critical), con una **leyenda** que explica cada métrica, los umbrales y los indicadores.
- **Reporte breve escrito por un modelo de IA** (Gemini): resumen de la sesión, 2–3 jugadores destacados y alertas de carga, en español o inglés, para el cuerpo técnico o para los jugadores.

Monorepo con **React + Vite** (frontend), **Node.js + Express** (API) y **PostgreSQL** (base de datos `oliver`).

> El registro completo de instrucciones y decisiones, prompt a prompt, está en [`log.md`](./log.md).

---

## 1. Cómo instalar y correr el proyecto

### Requisitos

- **Node.js ≥ 20.19** (probado con 22).
- **PostgreSQL** en ejecución (probado con 18).
- Una **API key de Gemini** (gratuita en https://aistudio.google.com/apikey). Es opcional: sin ella se puede usar `AI_PROVIDER=mock`.

### Paso a paso

```bash
# 1. Dependencias (npm workspaces: instala backend y frontend)
npm install

# 2. Configuración del backend
cp apps/server/.env.example apps/server/.env
#    Editar en apps/server/.env:
#      PGUSER / PGPASSWORD   -> usuario de PostgreSQL con permiso CREATEDB
#      GEMINI_API_KEY        -> tu API key (o AI_PROVIDER=mock para probar sin IA real)

# 3. Base de datos + seed: crea la base "oliver", aplica migraciones y carga el JSON
npm run db:setup

# 4. Backend (http://localhost:3001) y frontend (http://localhost:5173) a la vez
npm run dev
```

Abrir **http://localhost:5173**.

| Parte | Comando por separado | Detalle |
| --- | --- | --- |
| Backend | `npm run dev:server` | Express en el puerto 3001 (`node --watch`) |
| Frontend | `npm run dev:client` | Vite en el puerto 5173; `/api/*` se redirige a la API |
| Seed de datos | `npm run db:seed` | Carga `apps/server/db/seeds/data.json`. Es idempotente: se puede repetir sin duplicar. |
| Tests | `npm test` | 116 tests (backend + frontend); no necesitan base de datos ni API key |
| Tests de integración | `npm run test:db` | 10 tests contra PostgreSQL real, en una base temporal que se crea y se elimina sola |

<details>
<summary>Si el usuario de PostgreSQL no existe</summary>

```sql
-- como superusuario: psql -U postgres -h localhost
CREATE ROLE admin WITH LOGIN PASSWORD 'tu_password' CREATEDB;
-- si la base "oliver" ya existe:
ALTER DATABASE oliver OWNER TO admin;
\c oliver
ALTER SCHEMA public OWNER TO admin;   -- PostgreSQL 15+
```
</details>

---

## 2. Modelo de IA usado y por qué

**Modelo por defecto: `gemini-3.1-flash-lite`** (Google Gemini API), configurable con `GEMINI_MODEL`.

- **Por qué Gemini:** la API tiene un plan gratuito, soporta **salida estructurada con JSON Schema** (clave para no inventar datos) y la latencia es baja.
- **Por qué la variante Flash-Lite:** se probaron varios modelos con la API key real:
  - `gemini-2.5-flash` ya no está disponible para cuentas nuevas (404).
  - `gemini-3.8-flash` y `gemini-flash-latest` no respondían o devolvían 503 por alta demanda.
  - `gemini-3.1-flash-lite` respondió en **~2–8 s**, y sus reportes pasaron la validación anti-alucinación **al primer intento**, en las 3 sesiones, en los 2 idiomas y para las 2 audiencias.

  Para un resumen corto sobre datos ya calculados no hace falta un modelo grande: lo difícil (los cálculos y las alertas) lo hace el código.
- **Intercambiable:** el proveedor se elige con `AI_PROVIDER` (`gemini` | `mock`). Para añadir otro (OpenAI, Anthropic, Ollama…) basta con implementar `AiProvider.generate()` en `apps/server/src/ai/providers/` y registrarlo en `src/ai/index.js`, sin tocar rutas ni lógica de negocio.
- **La API key** solo vive en `apps/server/.env` (ignorado por git), viaja en la cabecera `x-goog-api-key` (nunca en la URL ni en los logs) y el frontend nunca la ve.

---

## 3. Decisiones de diseño principales y trade-offs

| Decisión | Por qué | Trade-off |
| --- | --- | --- |
| **El código calcula, la IA redacta.** Las alertas de umbral, promedios, rankings, distancia por minuto y excesos sobre el umbral se calculan antes de llamar al modelo. | Los LLM fallan con la aritmética; las alertas de carga no pueden depender de que el modelo "las vea". | Más lógica en el backend, y el modelo tiene menos libertad para hacer análisis propios. |
| **Defensa anti-alucinación en capas:** (1) JSON Schema generado por sesión con los `player_id` reales como `enum`; (2) validador que comprueba que cada número y cada nombre del texto libre exista en los datos; (3) un reintento indicando el problema; (4) si persiste, ese campo se reemplaza por texto generado por código y se marca `fallback`. | Requisito "nada de datos inventados": el reporte nunca contiene jugadores ni números que no existan, y siempre está disponible. | Solo se aceptan números literales del contexto, así que el modelo no puede calcular diferencias propias (por eso se las precalcula). El chequeo de nombres es heurístico. Hay hasta 1 llamada extra. |
| **Datos incompletos explícitos:** RPE `null` → no hay alerta ni valor supuesto; jugadores con menos del 50 % de los minutos → se comparan por minuto y quedan fuera de los promedios. | El dataset tiene casos borde a propósito: no se inventan valores y tampoco se ocultan. | El umbral del 50 % es una regla de negocio fija (documentada y fácil de cambiar). |
| **Errores del proveedor normalizados:** timeout → 504 (sin reintento); rate limit → reintento si la espera pedida es ≤ 5 s, si no 429 con `Retry-After`; 5xx o red → backoff. | Respuestas coherentes sea cual sea el proveedor, sin dejar al usuario esperando indefinidamente. | Un timeout puntual obliga al usuario a pulsar "Try again". |
| **Prompt versionado en un archivo `.md`** (`apps/server/prompts/session-report.v1.md`), elegido con `REPORT_PROMPT_VERSION` y devuelto en `meta.promptVersion`. | Legible y revisable en un PR; cada reporte es trazable a su prompt. | Hace falta un pequeño cargador de plantillas. |
| **PostgreSQL con SQL directo + DTOs + repositorios** (sin ORM); `workload_au` como **columna generada**. | Esquema explícito y validado (CHECKs, FKs); un solo punto de mapeo BD ↔ API; el dato derivado nunca queda inconsistente. | Más código de mapeo que con un ORM. |
| **Orden de la tabla en el servidor** (`order_by` con lista blanca → columnas SQL, `NULLS LAST`). | Usa el endpoint pedido y evita la inyección SQL. | Una petición por cada cambio de orden (son 12 filas, así que es despreciable). |
| **Inyección de dependencias** (`createApp(deps)`) y tests HTTP con repositorios en memoria y una IA simulada. | Tests rápidos sin base de datos ni red; el SQL real se cubre aparte con tests de integración contra PostgreSQL. | Los repositorios en memoria duplican la lógica de filtro y orden del SQL (el SQL se testea aparte). |
| **Frontend:** React + **shadcn/ui** (Radix + Tailwind v4) con la paleta de oliversports.ai; data table (TanStack) en escritorio y **tarjetas por jugador en móvil y tablet**; estados de carga, error y vacío explícitos. | Componentes accesibles (teclado, ARIA, tooltips reales) y consistentes con la marca; usable en un celular a pie de campo. | Más componentes en el repo (shadcn copia su código) y dos vistas para las métricas. |
| **Caché del reporte en `localStorage`**, con clave sesión + idioma + audiencia. Solo se guarda un reporte que **pasó la validación**, y el primero **nunca se sobreescribe** (el botón pasa a "Report saved"). | Evita llamadas repetidas a la IA (coste, cuota, latencia) y da un reporte estable para cada combinación; no requiere cambios en el servidor. | Es por navegador: dos usuarios pueden tener reportes distintos para la misma combinación, y se pierde si se borran los datos del sitio. Un reporte con partes de respaldo no se guarda, así que se puede volver a intentar. |
| **npm workspaces** (sin Turborepo / Nx), JavaScript con ES Modules (sin TypeScript). | Lo mínimo necesario para dos apps; arranque inmediato. | Sin tipado estático; los contratos se validan en tiempo de ejecución con DTOs. |

El detalle de cada decisión (con las alternativas descartadas) está en [`log.md`](./log.md).

---

## 4. Qué mejoraría o haría distinto con más tiempo

- **Caché compartido en el servidor** (tabla en PostgreSQL o KV): hoy el caché es por navegador; en el servidor, todos los usuarios verían el mismo reporte para cada combinación.
- **Streaming** de la respuesta del modelo para mostrar el reporte a medida que se genera y reducir la espera percibida.
- **Evals del prompt:** un conjunto de casos (sesiones con datos raros) que mida automáticamente la tasa de validación al primer intento, para comparar `v1` contra `v2` y entre modelos.
- **Validación semántica más fina:** hoy se verifica que cada número exista en los datos, pero no que esté **atribuido al jugador correcto**; el chequeo de nombres es heurístico.
- **Tests e2e** (Playwright) del flujo completo en un navegador real y en CI; hoy hay tests de componentes (Vitest + Testing Library) y la UI se verificó además con un navegador headless.
- **Docker Compose** (PostgreSQL + API + cliente) para levantar todo con un comando, incluyendo un volumen para la persistencia de datos en db.
- **Autenticación y multi-equipo:** el modelo de datos ya separa por `team_id`, pero no hay usuarios.
- **Code-splitting** del gráfico (Recharts hace que el bundle supere los 500 kB).
- **Tendencias entre sesiones** (carga acumulada o aguda:crónica), que es lo que más valor daría al entrenador para la gestión de cargas.

---

## 5. Uso de herramientas de IA para programar

Sí. El proyecto se desarrolló con **Claude Code** usando el modelo **Claude Opus 5.5** (Anthropic), con el que tengo experiencia previa.

**Cómo lo usé:**

- **Yo dirigía y la IA implementaba.** Cada instrucción que di (prompt) y las decisiones que resultaron quedaron registradas en [`log.md`](./log.md), con justificación y alternativas descartadas: 20+ prompts.
- **Decisiones mías, no del asistente:** establecí como regla que ante cualquier decisión de diseño poco clara me consultara antes de implementar. Esas consultas, con las opciones que se presentaron y lo que elegí, están en la sección *"Decisiones consultadas y tomadas por mí"* de `log.md`. Algunos ejemplos:
  - Recharts frente a Chart.js.
  - Qué hacer si la IA inventa un número (reintento + respaldo).
  - Solo números literales.
  - Prompt versionado en `.md`.
  - El modelo de Gemini.
  - Tema oscuro y colores de alerta.
  - Tarjetas en móvil.
  - Usar shadcn/ui.
- **Reglas que fijé:**
  - No modificar nunca el JSON de datos.
  - No leer nunca el `.env`: el asistente solo ejecutaba los scripts y me informaba del resultado.
  - Usar DTOs para la base de datos.
  - Que el proveedor de IA fuera intercambiable.
- **Verificación:** cada cambio se validó con tests automáticos (126: backend, frontend e integración con PostgreSQL), pruebas contra PostgreSQL y Gemini reales, y pruebas de la UI en un navegador headless (escritorio, tablet y móvil). Varios errores reales se detectaron así:
  - Un bug del validador que aceptaba `11,000` como `11`.
  - Un promedio inventado en un test, que el propio validador rechazó.
  - Un `Select` que pasaba de no controlado a controlado.
  - Columnas cortadas en la tabla.
  - Un paquete npm poco fiable que añadió el CLI de shadcn, sustituido por el estándar.
  - Un hook (`useAsync`) que podía mostrar la respuesta tardía de una sesión anterior, y avisos informativos marcados como `role="alert"` (los detectaron los tests de frontend).

---

## Referencia técnica

### Estructura

```
oliver/
├── apps/
│   ├── client/                # React + Vite + Tailwind v4 + shadcn/ui + Recharts (UI en inglés, tema de marca)
│   │   ├── src/
│   │   │   ├── components/      # SessionSelector, MetricsTable, MetricChart, ReportPanel, states
│   │   │   ├── components/ui/   # componentes de shadcn/ui (Card, Select, Table, Tooltip, Chart...)
│   │   │   ├── test/            # setup de Vitest y datos de prueba (los *.test.jsx viven junto a cada módulo)
│   │   │   ├── hooks/           # useAsync (fetch con cancelación), useMediaQuery
│   │   │   ├── lib/utils.js     # cn() de shadcn/ui
│   │   │   ├── api.js           # cliente HTTP
│   │   │   └── metrics.js       # definición y formato de métricas
│   │   ├── components.json      # configuración de shadcn/ui
│   │   └── vite.config.js       # alias @/ y proxy /api -> http://localhost:3001
│   └── server/                # Express + pg
│       ├── src/
│       │   ├── app.js             # composición de dependencias y manejo de errores
│       │   ├── db/                # pool PostgreSQL + parser del JSON de seed
│       │   ├── dtos/              # validación (fromJson / fromRequest) y mapeo (fromRow / toParams)
│       │   ├── repositories/      # SQL que recibe y devuelve DTOs
│       │   ├── services/          # sesiones, alertas y reporte (contexto, schema, validador, respaldo)
│       │   ├── ai/                # capa de IA intercambiable (gemini | mock) + reintentos
│       │   ├── prompts/           # cargador de prompts versionados
│       │   └── routes/            # HTTP <-> servicios
│       ├── prompts/               # session-report.v1.md
│       ├── db/migrations/         # SQL numerado
│       ├── db/seeds/data.json     # datos del challenge (no se modifica)
│       ├── scripts/               # create-db, migrate, seed
│       └── test/                  # node:test: unitarios (64) + integration/ con PostgreSQL real (10)
├── log.md                       # registro de decisiones
└── package.json                 # npm workspaces
```

### Modelo de datos

```
teams 1──N players
teams 1──N sessions
teams 1──N metric_thresholds
players N──M sessions  (vía player_sessions: métricas del jugador en la sesión)
```

`player_sessions.workload_au` es una columna generada (`rpe * minutes_played`); es `NULL` si falta el RPE.

### Scripts (desde la raíz)

| Script | Descripción |
| --- | --- |
| `npm run dev` | API + cliente en paralelo |
| `npm run dev:server` / `dev:client` | Cada app por separado |
| `npm run build` | Build de producción del cliente |
| `npm test` | Tests unitarios del backend (node:test) y del frontend (Vitest + Testing Library) |
| `npm run test:db` | Tests de integración contra PostgreSQL (base temporal `oliver_test_<pid>`; usa las credenciales del `.env`) |
| `npm run test:all` | Todos los anteriores |
| `npm run db:create` | Crea la base `oliver` si no existe |
| `npm run db:migrate` | Aplica las migraciones pendientes |
| `npm run db:seed` | Carga `apps/server/db/seeds/data.json` |
| `npm run db:setup` | Las tres anteriores en orden |

### Variables de entorno (`apps/server/.env`)

Ver [`apps/server/.env.example`](apps/server/.env.example). Las principales:

- **PostgreSQL:** `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`.
- **IA:**
  - `AI_PROVIDER`
  - `GEMINI_API_KEY`
  - `GEMINI_MODEL`
  - `AI_TIMEOUT_MS`
  - `AI_MAX_RETRIES`
  - `AI_RETRY_MAX_WAIT_MS`
  - `REPORT_PROMPT_VERSION`

### API

Servidor en `http://localhost:3001` (desde el cliente se accede como `/api/...` gracias al proxy de Vite).

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/health` | Estado de la API y conexión a la base de datos |
| GET | `/sessions` | Lista de sesiones: `id`, `date`, `title`, `type` |
| GET | `/sessions/:id/metrics` | Métricas de los jugadores de la sesión, umbrales y alertas |
| POST | `/sessions/:id/report` | Reporte generado por IA: resumen, destacados y alertas |

#### `GET /sessions/:id/metrics`

| Query | Valores | Por defecto |
| --- | --- | --- |
| `player_id` | id de jugador | todos |
| `order_by` | `shirt_number`, `name`, `position`, `minutes_played`, `total_distance_m`, `high_speed_running_m`, `sprints`, `max_speed_kmh`, `accelerations`, `rpe`, `workload_au` | `shirt_number` |
| `order` | `asc`, `desc` | `desc` para métricas, `asc` para dorsal, nombre y posición |

Los valores nulos (RPE no reportado) quedan siempre al final.

```bash
curl "http://localhost:3001/sessions/103/metrics?order_by=total_distance_m&order=desc"
curl "http://localhost:3001/sessions/103/metrics?player_id=5"
```

#### `POST /sessions/:id/report`

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

Errores: `400` parámetros inválidos, `404` sesión inexistente, `429` límite del proveedor de IA (con `Retry-After`), `502` fallo o respuesta inválida del proveedor, `504` timeout.
