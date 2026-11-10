# Registro de decisiones (Decision Log)

Este documento recoge, prompt a prompt, las instrucciones dadas durante el desarrollo del proyecto y las decisiones técnicas tomadas a partir de ellas, con su justificación.

---

## Prompt 1 — Creación del monorepo

**Fecha:** 2026-11-09

**Instrucción:**
> Crea un monorepo con las siguientes tecnologías: React con Vite, Node.js con Express, PostgreSQL. Los datos para llenar en la nueva base de datos llamada `oliver` los sacaremos de un JSON que después te mando. Para todos los prompts crea un `log.md` donde se detallen todas las tomas de decisiones para hacer este proyecto; es para entrega de una entrevista técnica.

### Decisiones

| # | Decisión | Justificación | Alternativas descartadas |
| --- | --- | --- | --- |
| 1 | **npm workspaces** para gestionar el monorepo | Viene incluido con npm (no requiere instalar nada más), suficiente para dos paquetes. Un solo `npm install` y un único `package-lock.json`. | pnpm (no instalado en el entorno), Turborepo/Nx (sobredimensionados para 2 apps). |
| 2 | Estructura `apps/client` y `apps/server` | Convención estándar de monorepos; separa claramente frontend y backend y deja sitio para un futuro `packages/` compartido. | `frontend/` + `backend/` en la raíz. |
| 3 | **JavaScript (ES Modules)** en ambos lados | Mantiene el proyecto simple y alineado con las tecnologías pedidas. ESM (`"type": "module"`) es el estándar moderno de Node. | TypeScript (se puede añadir más adelante si se requiere). |
| 4 | Frontend con **React 19 + Vite 8**, creado manualmente | Archivos mínimos y controlados en vez del boilerplate de `create-vite` (logos, contador demo, etc.). | `npm create vite` (añade código de ejemplo que habría que borrar). |
| 5 | **Proxy de Vite** `/api → http://localhost:3001` | El frontend llama a rutas relativas (`/api/...`), evitando URLs absolutas y problemas de CORS en desarrollo. | Variable `VITE_API_URL` con URL absoluta. |
| 6 | Backend **Express 5** separado en `app.js` (configuración) e `index.js` (arranque) | Permite testear la app sin levantar el puerto; Express 5 captura errores de handlers `async` de forma nativa. | Todo en un solo archivo. |
| 7 | Driver **`pg` (node-postgres)** con SQL directo, sin ORM | Para una prueba técnica muestra dominio de SQL y deja el esquema explícito y revisable. `pg` lee las variables estándar `PGHOST`, `PGUSER`, etc. | Prisma, Sequelize, Knex. |
| 8 | Configuración por **variables de entorno** con `node --env-file` | Node 20+ lo soporta de forma nativa: no hace falta `dotenv`. Se versiona `.env.example`; `.env` está en `.gitignore`. | Paquete `dotenv`. |
| 9 | Recarga en desarrollo con **`node --watch`** | Nativo de Node, sin dependencias extra. | `nodemon`. |
| 10 | Script **`db:create`** que crea la base `oliver` si no existe | Hace el setup reproducible para quien evalúe el proyecto. Se conecta a la base `postgres` porque no se puede crear una base estando conectado a ella. Usa `escapeIdentifier` para el nombre. | Crearla a mano con `psql`. |
| 11 | **Migraciones SQL propias** (`db/migrations/NNN_*.sql`) con tabla `schema_migrations` | Sistema mínimo, transaccional e idempotente: cada migración se aplica una sola vez y si falla se hace rollback. | `node-pg-migrate`, Knex migrations. |
| 12 | **Seed desde JSON** en `db/seeds/data.json` (script `db:seed`) preparado pero sin lógica de inserción | El JSON aún no se ha recibido; el esquema y el mapeo se definirán a partir de su estructura real en lugar de suponerla. | Inventar un esquema provisional. |
| 13 | Endpoint **`GET /api/health`** y página inicial que lo consume | Verifica de extremo a extremo frontend → API → PostgreSQL. Si la BD no está disponible responde `503` con el motivo, en vez de tumbar el servidor. | — |
| 14 | `concurrently` en la raíz: `npm run dev` levanta API y cliente | Un solo comando para arrancar todo el proyecto. | Dos terminales. |
| 15 | Sin Docker por ahora | Docker no está instalado en el entorno de desarrollo; se usa la instancia local de PostgreSQL 18. | `docker-compose` con Postgres (se puede añadir para facilitar la evaluación). |

### Verificación
- `npm run build` del cliente: correcto.
- La API arranca en el puerto 3001 y `/api/health` responde (503 controlado mientras no esté configurada la contraseña de PostgreSQL en `apps/server/.env`).
- `npm run db:create` conecta con PostgreSQL; pendiente de configurar credenciales locales.

### Pendiente
- Recibir el JSON de datos → diseñar el esquema (migración `001_*.sql`) e implementar el seed. ✅ Resuelto en el Prompt 2.

---

## Prompt 2 — Contexto del producto, datos JSON y configuración de Gemini

**Fecha:** 2026-11-09

**Instrucción:**
> Contexto: un entrenador quiere revisar rápidamente cómo le fue a su equipo en una sesión (entrenamiento o partido). Necesita ver las métricas de cada jugador en una **tabla** y en un **gráfico**, y generar un **reporte breve escrito por un modelo de IA** que resuma la sesión, destaque jugadores y alerte sobre cargas de trabajo altas. El JSON de ejemplo contiene un equipo, 12 jugadores, 3 sesiones y los umbrales de referencia de cada métrica (datos ficticios).
> También habrá una integración con la **API de Gemini** para interpretar los datos. Crear `.env` y `.env.example` y dar el paso a paso para crear la API key de Gemini. JSON: `session_data.json`.

### Análisis del JSON
- `team` (1), `players` (12), `sessions` (3: 2 entrenamientos + 1 partido), `player_sessions` (36 filas de métricas).
- `thresholds`: `workload_au` (warning 600 / critical 750), `total_distance_m` (warning 9500), `sprints` (warning 28), `rpe` (warning 8).
- `rpe` puede ser `null` (jugador 9 en la sesión 103), y entonces `workload_au` también es `null`.
- `workload_au = rpe * minutes_played`: verificado en las 36 filas, sin inconsistencias.

### Decisiones

| # | Decisión | Justificación | Alternativas descartadas |
| --- | --- | --- | --- |
| 1 | Modelo relacional normalizado: `teams`, `players`, `sessions`, `player_sessions`, `metric_thresholds` | Refleja las entidades reales. `player_sessions` es la tabla puente N:M con PK compuesta `(session_id, player_id)`, que impide duplicar un jugador en una sesión. | Guardar el JSON en una columna `JSONB` (pierde integridad y complica las consultas). |
| 2 | Se conservan los **IDs del JSON** como claves primarias | Mantiene la trazabilidad con la fuente y permite un seed idempotente. | IDs `SERIAL` nuevos con tabla de mapeo. |
| 3 | `workload_au` como **columna generada** (`GENERATED ALWAYS AS (rpe * minutes_played) STORED`) | Es un dato derivado: calcularlo en la base garantiza que nunca sea inconsistente y gestiona solo el caso `rpe = NULL`. El seed compara el valor del JSON con el cálculo y avisa si no coinciden. | Guardar el valor del JSON tal cual (riesgo de inconsistencia). |
| 4 | `rpe` **nullable** con `CHECK (rpe BETWEEN 1 AND 10)` | El dato puede faltar según el README del JSON; no se inventan valores (ni 0 ni promedios). La UI y la IA deberán tratarlo como "sin dato". | Imputar un valor por defecto. |
| 5 | **CHECK constraints** en enums y rangos (`position`, `type`, valores ≥ 0) y `UNIQUE (team_id, shirt_number)` | La base valida la integridad aunque los datos lleguen por otra vía distinta del seed. | Validar solo en la aplicación. |
| 6 | Umbrales en la tabla `metric_thresholds (team_id, metric, warning, critical)` | Son configuración por equipo, no constantes del código: se pueden cambiar sin desplegar. `critical` es opcional porque solo `workload_au` lo tiene. | Hardcodearlos en el frontend o en el backend. |
| 7 | `max_speed_kmh` como `NUMERIC(4,1)` | Es un valor decimal exacto con un solo decimal, como en la fuente. | `REAL` (punto flotante impreciso). |
| 8 | Índices en `players(team_id)`, `sessions(team_id, date DESC)` y `player_sessions(player_id)` | Cubren las consultas previstas: listar sesiones de un equipo por fecha y obtener el historial de un jugador. | — |
| 9 | Seed **transaccional e idempotente** (UPSERT con `ON CONFLICT`) | Si algo falla no quedan datos a medias, y se puede re-ejecutar `db:seed` sin duplicar. | `TRUNCATE` + `INSERT` (destructivo). |
| 10 | JSON copiado a `apps/server/db/seeds/data.json` (versionado) | Quien evalúe el proyecto puede reproducir la base de datos con `npm run db:setup` sin depender de rutas locales. | Leerlo desde la carpeta de Descargas. |
| 11 | Variables `GEMINI_API_KEY` y `GEMINI_MODEL` **solo en el servidor** (`apps/server/.env`) | Las variables `VITE_*` se incrustan en el bundle del navegador y quedarían expuestas. El frontend pedirá el reporte a Express, y Express llama a Gemini. | Llamar a Gemini directamente desde React. |
| 12 | Modelo configurable por entorno, por defecto `gemini-2.5-flash` | Flash es rápido y económico, adecuado para resúmenes cortos; el modelo se puede cambiar sin tocar código. | Fijar el modelo en el código. |
| 13 | `.env` ignorado por git; `.env.example` versionado y sin secretos | Buenas prácticas: no se suben credenciales al repositorio. | — |
| 14 | Mensaje de error legible cuando falla la conexión a PostgreSQL en los scripts CLI | Al probarlo, un error de autenticación mostraba un stack trace confuso; ahora indica qué variable revisar. | — |

### Paso a paso: crear la API key de Gemini
1. Entrar en **https://aistudio.google.com/apikey** con una cuenta de Google.
2. Aceptar los términos de Google AI Studio la primera vez.
3. Pulsar **"Create API key"** y elegir o crear un proyecto de Google Cloud (AI Studio puede crear uno automáticamente).
4. Copiar la clave generada.
5. Pegarla en `apps/server/.env` → `GEMINI_API_KEY=tu_clave`. **Nunca** en `.env.example` ni en el código.
6. (Opcional) Comprobar los modelos disponibles y sus límites del plan gratuito en https://ai.google.dev/gemini-api/docs/models y ajustar `GEMINI_MODEL`.
7. (Recomendado) En Google Cloud Console → *APIs & Services → Credentials*, restringir la clave a la **Generative Language API**.

### Verificación
- La migración `001_initial_schema.sql` y el seed están implementados.
- Validación offline del JSON: 36 filas de métricas, 0 inconsistencias en `workload_au`.
- `apps/server/.env` confirmado como ignorado por git.
- ⚠ No se pudo ejecutar `db:setup` contra PostgreSQL: falta la contraseña local en `apps/server/.env` (error `28P01`, autenticación fallida).

### Pendiente
- Configurar `PGPASSWORD` y `GEMINI_API_KEY` en `apps/server/.env` y ejecutar `npm run db:setup`.
- Endpoints de la API (sesiones, métricas por sesión, umbrales).
- UI: selector de sesión, tabla y gráfico de métricas con alertas por umbral.
- Integración con Gemini: endpoint que genere el reporte de la sesión.

---

## Prompt 3 — Herramienta de IA usada para el desarrollo, variables de BD y DTOs

**Fecha:** 2026-11-09

**Instrucción:**
> Agregar como decisión de diseño que el modelo utilizado para implementar este sistema fue **Claude Opus 5.5**, ya que es un modelo con el que tengo experiencia. Agregar en los `.env` lo necesario para la base de datos (los valores reales los coloco yo). Para la integración con PostgreSQL, utilizar **DTOs** para cargar y obtener la información de la base de datos.

### Decisiones

| # | Decisión | Justificación | Alternativas descartadas |
| --- | --- | --- | --- |
| 1 | **Claude Opus 5.5** (vía Claude Code) como asistente de IA para implementar el sistema | Es un modelo con el que tengo experiencia previa, lo que me permite guiarlo con precisión, revisar críticamente su salida y mantener el control de las decisiones técnicas. Cada instrucción dada y cada decisión resultante quedan trazadas en este `log.md`. | Otros asistentes de código. |
| 2 | Distinción explícita entre **IA de desarrollo** (Claude Opus 5.5) e **IA del producto** (Gemini, intercambiable) | Son dos usos independientes: una herramienta para construir el sistema y una dependencia en tiempo de ejecución para generar los reportes. | — |
| 3 | Variables de BD en `.env`: `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, más `PG_POOL_MAX` y `PGSSL` | Se usan los nombres estándar de libpq, que `pg` y `psql` leen de forma nativa. `PG_POOL_MAX` ajusta el pool sin tocar código y `PGSSL` permite usar bases de datos en la nube que exigen SSL. Se añadieron al `.env` existente **sin sobrescribir** los valores que ya hubiera. | Una única `DATABASE_URL` (menos legible para rellenar a mano). |
| 4 | **DTOs** (`src/dtos/`) con tres responsabilidades: `fromJson()` (entrada: valida y normaliza), `fromRow()` (salida: `snake_case` de la BD → `camelCase` de la API, con tipos correctos) y `toParams()` (parámetros ordenados para el `INSERT`) | Un solo punto de mapeo por entidad: la forma de la BD no se filtra a la API ni al frontend, y los datos inválidos se rechazan antes de llegar a PostgreSQL. | Pasar las filas de `pg` tal cual a la API. |
| 5 | DTOs **inmutables** (`Object.freeze`) | Evita mutaciones accidentales entre capas. | — |
| 6 | **Capa de repositorios** (`src/repositories/`): la única que escribe SQL; recibe y devuelve DTOs | Separa el acceso a datos de la lógica de negocio. Cada función acepta un `db` opcional (pool o cliente) para poder participar en transacciones. | SQL disperso en las rutas. |
| 7 | El seed **valida todo el JSON con DTOs antes de abrir la transacción** (`parseSeedData`) | Si un dato es inválido, falla rápido con un mensaje que indica el campo exacto (p. ej. `sessions[id=101].player_sessions[player_id=1].rpe`), sin tocar la BD. También valida la integridad referencial (jugador inexistente) y que `minutes_played ≤ duration_min`. | Dejar que la BD rechace los datos en mitad de la carga. |
| 8 | Tipos de `pg` corregidos: `DATE` se lee como string `YYYY-MM-DD` (type parser) y `NUMERIC` se convierte a `number` en `fromRow()` | Por defecto `pg` convierte `DATE` a un `Date` en la zona horaria local (puede desplazar el día) y devuelve `NUMERIC` como string. | — |
| 9 | **Tests unitarios** con `node:test` (`npm test`) | Runner nativo de Node, sin dependencias. Cubren el JSON completo, el RPE nulo, las validaciones, el mapeo `fromRow` y la exclusión de la columna generada. | Jest / Vitest. |

### Verificación
- `npm test`: 6/6 tests de DTOs en verde.
- `.env` actualizado solo añadiendo variables (verificado listando los nombres, sin leer los valores).

---

## Prompt 4 — Proveedor de IA totalmente parametrizable

**Fecha:** 2026-11-09

**Instrucción:**
> Hacer que la implementación del modelo de IA (en este primer caso Gemini) sea totalmente parametrizable, de forma que se pueda sustituir esa API sin problemas.

### Diseño

```
src/ai/
├── ai-provider.js            # Contrato: AiProvider.generate(request) -> AiResponse + AiProviderError
├── index.js                  # Factoría + registro: AI_PROVIDER -> proveedor concreto
└── providers/
    ├── gemini.provider.js    # Implementación Gemini (REST)
    └── mock.provider.js      # Implementación falsa para desarrollo y tests
```

El resto de la aplicación solo llama a `getAiProvider().generate({ system, prompt, json })` y recibe `{ text, provider, model, usage }`, sin saber qué API hay detrás.

### Decisiones

| # | Decisión | Justificación | Alternativas descartadas |
| --- | --- | --- | --- |
| 1 | Patrón **Strategy + Factory**: clase base `AiProvider` con un único método `generate()`, y una factoría que elige la implementación según `AI_PROVIDER` | Cambiar de proveedor = escribir una clase y cambiar una variable de entorno. Ni las rutas ni la lógica del reporte cambian (principio abierto/cerrado). | `if (provider === 'gemini')` repartidos por el código. |
| 2 | Request/response **normalizados** (`prompt`, `system`, `temperature`, `maxOutputTokens`, `json` → `text`, `model`, `usage`) | Son los conceptos comunes a cualquier LLM. Cada proveedor traduce a su formato propio (p. ej. Gemini usa `systemInstruction` y `generationConfig`). | Exponer el formato de Gemini al resto del código. |
| 3 | Gemini vía **API REST con `fetch` nativo**, sin SDK | Cero dependencias, control total del request y fácil de testear inyectando `fetch`. El SDK acoplaría el código a los tipos de Google. | `@google/genai`. |
| 4 | **Configuración 100% por entorno**: `AI_PROVIDER`, `AI_TEMPERATURE`, `AI_MAX_OUTPUT_TOKENS`, `AI_TIMEOUT_MS` (comunes) y `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_BASE_URL` (específicas) | Modelo, endpoint y parámetros se cambian sin tocar código. Solo la factoría lee `process.env`; los proveedores reciben su configuración por constructor (más fáciles de testear). | Constantes en el código. |
| 5 | **Error tipado** `AiProviderError` con código HTTP (502 fallo del proveedor, 504 timeout, 429 límite de cuota) | El error handler de Express responde con un código coherente sea cual sea el proveedor. | Propagar errores crudos de cada API. |
| 6 | **Timeout** con `AbortSignal.timeout` (`AI_TIMEOUT_MS`) | Una API externa lenta no debe dejar la petición del usuario colgada indefinidamente. | — |
| 7 | API key en la cabecera `x-goog-api-key`, no en la URL | Las URLs suelen quedar en logs; la cabecera no. | Parámetro `?key=`. |
| 8 | Proveedor **`mock`** (`AI_PROVIDER=mock`) | Permite desarrollar la UI y ejecutar los tests sin API key, sin red y sin coste. | — |
| 9 | Instancia **perezosa** (`getAiProvider()`) | El servidor arranca aunque falte la API key; el error solo aparece al pedir un reporte. | Crear el proveedor al arrancar. |

**Cómo añadir otro proveedor (p. ej. OpenAI):** crear `providers/openai.provider.js` extendiendo `AiProvider`, añadir `openai: (env, common) => new OpenAiProvider({...})` en `PROVIDERS` (`src/ai/index.js`) y poner `AI_PROVIDER=openai` en el `.env`.

### Verificación
- `npm test`: 11/11 en verde (6 de DTOs + 5 de IA). Los tests de Gemini usan un `fetch` simulado: verifican la URL, que la key va en la cabecera y no en la URL, el `systemInstruction`, el modo JSON, la normalización de la respuesta y los errores 429 y por bloqueo de seguridad.
- No se probó contra la API real de Gemini: falta `GEMINI_API_KEY` en `.env`.

### Pendiente
- Rellenar `PGPASSWORD` y `GEMINI_API_KEY` en `apps/server/.env` y ejecutar `npm run db:setup`.
- Endpoints REST (sesiones, métricas, umbrales) usando los repositorios.
- Servicio de reporte: construir el prompt con las métricas y umbrales de la sesión y llamar a `getAiProvider()`.
- UI: tabla, gráfico y reporte.
