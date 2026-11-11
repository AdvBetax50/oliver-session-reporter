# Registro de decisiones (Decision Log)

Este documento recoge, prompt a prompt, las instrucciones dadas durante el desarrollo del proyecto y las decisiones técnicas tomadas a partir de ellas, con su justificación.

---

## Decisiones consultadas y tomadas por mí

Decisiones de diseño en las que el asistente de IA (Claude Opus 5.5) **me consultó antes de implementar**, porque había más de una opción razonable. Se registran las opciones que se presentaron, la elegida y el motivo. Desde el Prompt 6 la regla es: *si una decisión no queda clara, se me pregunta*.

### Consultadas (pregunta → respuesta)

| # | Prompt | Pregunta | Opciones presentadas | Elegida | Motivo |
| --- | --- | --- | --- | --- | --- |
| C1 | 6 | Librería para el gráfico de barras | Recharts · Chart.js + react-chartjs-2 · SVG propio | **Recharts** | Pregunté por qué Chart.js necesita dos librerías: Chart.js no es de React (dibuja en canvas con una API imperativa) y `react-chartjs-2` es el adaptador. Recharts es nativa de React y declarativa: umbrales (`ReferenceLine`) y colores por barra (`Cell`) se escriben en JSX. Chart.js solo compensa con miles de puntos; aquí hay 12 jugadores. |
| C2 | 6 | Estilos de la interfaz | CSS propio con variables · Tailwind CSS · Librería de componentes (MUI/Chakra) | **Tailwind CSS** | Iteración rápida y un diseño consistente sin escribir CSS a mano. |
| C3 | 6 | Dónde se ordena la tabla al hacer clic en una columna | En el servidor (`?order_by&order`) · En el cliente | **En el servidor** | Integra el endpoint pedido en el enunciado (`order_by`, `order`) en lugar de duplicar la lógica. |
| C4 | 6 | Idioma de la interfaz | Solo español · Bilingüe es/en | **Solo inglés** | Decisión propia. El reporte de IA sigue pudiendo pedirse en `es` o `en`. |
| C5 | 7 | Qué hacer si la IA escribe un número que no está en los datos | Reintento + respaldo · Reintento + error 502 · Solo error 502 | **Reintento + respaldo** | Se reintenta 1 vez explicándole al modelo qué falló; si vuelve a fallar, los campos inválidos se reemplazan por texto generado por código con datos verificados (marcado "Data-based"). El entrenador siempre recibe un reporte, y nunca con datos inventados. |
| C6 | 7 | ¿Se permiten números derivados (diferencias, %) que el código no envió? | Solo literales · Sí, con tolerancia | **Solo literales** | Validación simple y fiable. Para que el modelo pueda dar comparaciones útiles, el código las precalcula (exceso sobre el umbral, % frente al promedio del equipo, rankings) y se las envía. |
| C7 | 7 | Formato del prompt versionado | Archivo `.md` por versión · Módulo JS por versión | **Archivo `.md` por versión** | `prompts/session-report.v1.md` con secciones y `{{placeholders}}`: lo más legible y fácil de revisar en un PR. La versión usada se devuelve en `meta.promptVersion`. |
| C8 | 8 | Modelo de Gemini por defecto | gemini-3.1-flash-lite · gemini-3.8-flash · gemini-flash-latest | **gemini-3.1-flash-lite** | `gemini-2.5-flash` ya no está disponible para cuentas nuevas (404). `gemini-3.8-flash` (el recomendado por Google) no respondía en 120 s por alta demanda, y `gemini-flash-latest` devolvía 503. `gemini-3.1-flash-lite` respondió en ~1,6–3 s y sus reportes reales pasaron la validación al primer intento. Se puede cambiar con `GEMINI_MODEL` sin tocar código. |
| C9 | 19 | Cómo aplicar la paleta de oliversports.ai (el sitio es mayormente oscuro) | Tema oscuro como el sitio · Claro con header de marca | **Tema oscuro como el sitio** | Fondo navy `#001c26 → #003c51`, texto blanco y azul `#2378f8` / rosa `#e04080` como acentos: la app se ve coherente con la marca. |
| C10 | 19 | Colores de los niveles de alerta (la paleta de OLIVER no tiene rojo) | Amarillo + rosa de marca · Amarillo de marca + rojo estándar | **Amarillo de marca + rojo estándar** | Warning = amarillo CTA del sitio `#f9b82c`; Critical = rojo convencional `#ef4444`, por su significado universal de "peligro". El rosa queda como acento decorativo. |
| C11 | 21 | Cómo mostrar la tabla de 11 métricas en celular (~390 px) | Tarjetas por jugador · Tabla con scroll horizontal | **Tarjetas por jugador** | En móvil y tablet cada jugador es una tarjeta con todas sus métricas en grilla y los umbrales resaltados; el orden se elige con un Select + botón asc/desc (sigue resolviéndose en el servidor). La tabla se mantiene en escritorio. Con scroll horizontal solo se verían ~2 métricas a la vez. |

### Indicadas directamente por mí (sin consulta previa)

| # | Prompt | Decisión |
| --- | --- | --- |
| D1 | 1 | Monorepo con React + Vite, Node.js + Express y PostgreSQL; base de datos `oliver` cargada desde un JSON. |
| D2 | 1 | Registrar en este `log.md` todas las decisiones de cada prompt (entrega para una entrevista técnica). |
| D3 | 2 | Integración con la API de Gemini para interpretar los datos; `.env` y `.env.example`. |
| D4 | 3 | Usar **Claude Opus 5.5** como asistente para implementar el sistema, por mi experiencia previa con ese modelo. |
| D5 | 3 | Usar **DTOs** para cargar y obtener los datos de PostgreSQL. |
| D6 | 3 | Dejar en los `.env` las variables de la BD; los valores reales los coloco yo. |
| D7 | 4 | Hacer el proveedor de IA **totalmente parametrizable** para poder sustituir Gemini sin problemas. |
| D8 | 6 | Ante cualquier decisión poco clara, consultarme (origen de la tabla anterior). |
| D9 | 7 | El JSON de datos (`session_data.json`) **no se modifica** nunca. |
| D10 | 7 | Registrar las decisiones consultadas en una sección propia del log (esta sección). |
| D11 | 8 | El asistente **nunca lee el `.env`** (ni valores ni estructura): solo ejecuta los scripts de la app, que lo cargan por su cuenta, e informa el resultado. |
| D12 | 16–18 | Pausa temporal del registro en el log (Prompts 16–18), reactivada en el Prompt 19 con la indicación de registrar también lo pausado. |
| D13 | 19 | Gráfico y reporte **uno debajo del otro** con CSS flex. |
| D14 | 19 | Usar la **paleta de colores de oliversports.ai** en todo el frontend. |
| D15 | 21 | Ampliar el ancho del Select de sesión (se cortaba) y hacer la app **responsive**. |
| D16 | 21 | El README debe incluir: instalación y ejecución (backend, frontend, seed), modelo de IA y por qué, decisiones de diseño y trade-offs, mejoras con más tiempo y uso de herramientas de IA. |
| D17 | 21 | Separar los cambios en **varios commits**. |
| D18 | 21 | Añadir una **leyenda en un dialog** con todos los conceptos, según la referencia de campos del enunciado. |

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
- Endpoints REST (sesiones, métricas, umbrales) usando los repositorios. ✅ Prompt 5.
- Servicio de reporte: construir el prompt con las métricas y umbrales de la sesión y llamar a `getAiProvider()`. ✅ Prompt 5.
- UI: tabla, gráfico y reporte.

---

## Prompt 5 — Backend: endpoints de sesiones, métricas y reporte con IA

**Fecha:** 2026-11-10

**Instrucción (enunciado 3.1 Backend):**
> Cargar el JSON en una base SQL con un modelo relacional simple y un script de seed.
> - `GET /sessions`: lista de sesiones (id, fecha, título, tipo).
> - `GET /sessions/:id/metrics`: métricas de todos los jugadores de la sesión, con filtro por jugador (`?player_id=5`) y orden por métrica (`?order_by=total_distance_m&order=desc`).
> - `POST /sessions/:id/report`: arma el contexto con los datos de la sesión, llama a un modelo de IA y devuelve un reporte para el entrenador con un resumen general, 2 o 3 jugadores destacados con el motivo y alertas de jugadores que superaron los umbrales. Debe aceptar `language` (`es` | `en`) y `audience` (`coach` | `player`).

> La base de datos, el modelo relacional y el seed ya estaban resueltos en los Prompts 1–3 (PostgreSQL, `teams` / `players` / `sessions` / `player_sessions` / `metric_thresholds`, `npm run db:seed`).

### Arquitectura en capas

```
routes/      HTTP -> valida la entrada con DTOs (MetricsQueryDTO, ReportRequestDTO) -> llama al servicio
services/    lógica de negocio: session.service, alerts, report/ (contexto, prompt, servicio)
repositories/ SQL -> DTOs
ai/          proveedor de IA intercambiable
```

`createApp(deps)` recibe los servicios ya construidos (**inyección de dependencias**): en producción usan PostgreSQL y Gemini; en los tests, repositorios en memoria y una IA simulada.

### Decisiones

| # | Decisión | Justificación | Alternativas descartadas |
| --- | --- | --- | --- |
| 1 | Rutas **exactamente como el enunciado** (`/sessions`, sin prefijo `/api`); el proxy de Vite traduce `/api/*` → `/*` | Se respeta el contrato pedido y el frontend sigue llamando a `/api/...` sin CORS. `/api/health` pasó a ser `/health`. | Prefijo `/api` en el servidor (cambiaría las rutas del enunciado). |
| 2 | `GET /sessions` devuelve solo `id`, `date`, `title`, `type`, ordenadas de la más reciente a la más antigua | Es lo que pide el enunciado; lo más reciente es lo más relevante para el entrenador. | Devolver la entidad completa. |
| 3 | Query params en `snake_case` (`player_id`, `order_by`) y valores de `order_by` iguales a los nombres de las métricas del JSON | Coincide con los ejemplos del enunciado y con el vocabulario de los datos. El cuerpo de las respuestas sigue en `camelCase` (DTOs). | — |
| 4 | **Filtro y orden en SQL**, con `order_by` validado contra una **lista blanca** que se traduce a columnas | Postgres ordena y filtra de forma eficiente; la lista blanca hace imposible la inyección SQL (los nombres de columna no se pueden parametrizar). Un chequeo al arrancar garantiza que la lista del DTO y el mapeo a columnas coinciden. | Ordenar en memoria en Node; interpolar `order_by`. |
| 5 | `NULLS LAST` siempre y desempate por dorsal | Un RPE no reportado no debe aparecer como "el más alto" ni "el más bajo". El desempate da un orden determinista. | — |
| 6 | `order` por defecto: `desc` al ordenar por una métrica y `asc` por dorsal, nombre o posición | Al ordenar por métrica, la pregunta típica es "quién hizo más". | Siempre `asc`. |
| 7 | La respuesta de `/metrics` incluye además `thresholds` y `alerts` | La UI necesita los umbrales para resaltar celdas y el gráfico, y así se evita una segunda petición. | Endpoint aparte para umbrales. |
| 8 | **Las alertas las calcula el código, no el LLM** (`services/alerts.js`) | Es lógica determinista y crítica para la salud del jugador: no puede depender de que el modelo "lo vea". El modelo solo redacta un comentario por alerta. | Pedirle al modelo que detecte las alertas. |
| 9 | Umbral superado al **alcanzar** el valor (`>=`); nivel `critical` si existe y se alcanza | Un RPE de 8 con warning 8 ya es esfuerzo alto. Con `>` estricto, un RPE de 8 nunca alertaría. | `>` estricto. |
| 10 | Los datos ausentes (RPE `null`) **no generan alerta** y se informan aparte (`players_without_rpe`) | No se puede afirmar que alguien superó un umbral sin el dato; tampoco se oculta que falta. | Tratar `null` como 0. |
| 11 | Contexto para el LLM con **datos ya agregados** (promedios del equipo, `distance_per_min`, alertas calculadas) | Los LLM fallan con la aritmética; se les da el cálculo hecho para que interpreten. `distance_per_min` compara con justicia a quien jugó menos (p. ej. Franco Medina, 28 min). | Enviar solo las filas crudas. |
| 12 | Prompt con **instrucciones en inglés** y el idioma de salida como parámetro (`es` / `en`) | Los modelos siguen con más fiabilidad instrucciones en inglés; el idioma de la respuesta se controla aparte. | Un prompt por idioma (duplicación). |
| 13 | `audience` cambia el **tono**: `coach` técnico, con implicaciones de carga y recomendaciones; `player` motivador, sin jerga, en segunda persona y con las alertas planteadas como consejos de recuperación | Mismo dato, distinto lector. | — |
| 14 | Reglas anti-alucinación en el prompt: usar solo los datos dados, no inventar, no reevaluar alertas | Reduce invenciones y deja claro qué es fuente de verdad. | — |
| 15 | **Salida JSON estructurada** (`json: true`) y **validación posterior**: se descartan destacados de jugadores inexistentes o duplicados, se limitan a 3 y se ignoran comentarios de alertas que no existen | El modelo redacta, el código decide qué es verdad. | Devolver el texto del modelo sin verificar. |
| 16 | **Fallback** si el modelo devuelve menos de 2 destacados: se completan con los jugadores de mayor distancia, con un motivo generado por plantilla en el idioma pedido y `source: "fallback"` | El contrato de la API (2–3 destacados) se cumple siempre, y queda claro qué parte escribió la IA. | Devolver error. |
| 17 | Respuesta del modelo con JSON inválido → **502** con mensaje claro (y se toleran las vallas ```json) | Es un fallo del servicio externo, no del cliente. | 500 genérico. |
| 18 | `language` y `audience` en el **body JSON** (también se aceptan en la query); por defecto `es` y `coach` | Es un POST; aceptar la query facilita probar con `curl`. Valores fuera de la lista → 400 **antes** de llamar a la IA (no se gasta cuota). | Solo query string. |
| 19 | El reporte incluye `meta` (proveedor, modelo, tokens, fecha) | Trazabilidad y control de coste; útil al cambiar de proveedor. | — |
| 20 | Errores: `400` validación, `404` sesión o ruta inexistente, `502` / `504` / `429` IA. El error handler solo devuelve el mensaje de errores marcados como `expose`; el resto responde `Internal server error` | No se filtran detalles internos (SQL, stack traces) al cliente. | Devolver `err.message` siempre. |
| 21 | `express.json({ limit: '10kb' })` | Los bodies esperados son mínimos; limita abusos. | Límite por defecto (100kb). |
| 22 | **Tests de API por HTTP** (`node:test` + `fetch` contra `app.listen(0)`) con repositorios en memoria alimentados por el mismo JSON | Prueban el flujo completo ruta → DTO → servicio → repositorio sin PostgreSQL ni red. El SQL de métricas se testea aparte como función pura (`buildMetricsQuery`). | Supertest (dependencia extra); tests solo contra una BD real. |

### Verificación
- `npm test`: **25/25** en verde (6 DTOs + 5 IA + 14 API/SQL). Cubren listado y orden de sesiones; métricas, filtro, orden, `NULLS LAST` y errores 400/404; reporte en `en`/`player` y por defecto `es`/`coach`; descarte de jugadores y alertas inventados; fallback de destacados; 400 sin llamar a la IA; 502 ante JSON inválido; protección del `ORDER BY`.
- `npm run build` del cliente: correcto con el nuevo proxy.
- ⚠ No se probó contra PostgreSQL real (sigue fallando la autenticación: error `28P01` con el usuario configurado) ni contra Gemini real (falta `GEMINI_API_KEY`).

### Pendiente
- Corregir las credenciales de PostgreSQL en `apps/server/.env`, ejecutar `npm run db:setup` y probar los endpoints contra la BD real.
- Probar `POST /sessions/:id/report` con Gemini real y ajustar el prompt si hace falta.
- Frontend: selector de sesión, tabla, gráfico y reporte. ✅ Prompt 6.
- Posibles mejoras: caché de reportes por `(sesión, idioma, audiencia)`, un reintento si el JSON del modelo es inválido, y `audience=player` personalizado para un jugador concreto.

---

## Prompt 6 — Frontend: selector, tabla, gráfico, umbrales y reporte

**Fecha:** 2026-11-10

**Instrucción:**
> Si alguna decisión no queda clara, preguntarla. Para el frontend:
> - Selector de sesión.
> - Tabla con las métricas de los jugadores de la sesión seleccionada, ordenable por columna.
> - Un gráfico simple, por ejemplo barras por jugador para una métrica que se pueda elegir.
> - Resaltado visual de los valores que superan los umbrales.
> - Un botón "Generar reporte" que muestre el reporte generado por la IA, contemplando los estados de carga, error y vacío.

### Decisiones consultadas antes de implementar

| Pregunta | Respuesta | Motivo |
| --- | --- | --- |
| Librería de gráficos | **Recharts** (recomendada tras explicar las diferencias) | Es nativa de React: los gráficos son componentes JSX declarativos, y umbrales (`ReferenceLine`) y colores por barra (`Cell`) se expresan directamente en JSX. Chart.js no es de React (dibuja en canvas con una API imperativa) y necesita el adaptador `react-chartjs-2`, de ahí las dos librerías. Chart.js solo compensaría con miles de puntos; aquí hay 12 jugadores. |
| Estilos | **Tailwind CSS** (v4, plugin oficial de Vite) | Elección del usuario: iteración rápida y un diseño consistente con utilidades. |
| Dónde se ordena la tabla | **En el servidor** (`?order_by=&order=`) | Aprovecha e integra el endpoint construido en el Prompt 5. |
| Idioma de la interfaz | **Solo inglés** | Elección del usuario. El reporte de IA se puede pedir en inglés o español con un selector. |

### Decisiones de implementación

| # | Decisión | Justificación | Alternativas descartadas |
| --- | --- | --- | --- |
| 1 | Al cargar se selecciona la **sesión más reciente** | Es la que el entrenador quiere revisar normalmente; evita una pantalla vacía. | Pedir que se elija una sesión primero. |
| 2 | Hook `useAsync` propio con **AbortController** | Cancela la petición anterior al cambiar de sesión u orden: nunca se pinta una respuesta vieja (condición de carrera). Sin dependencias. | React Query / SWR (sobredimensionado para 3 endpoints). |
| 3 | Al reordenar se **mantienen los datos previos** atenuados mientras llega la respuesta | Evita parpadeos. Al cambiar de sesión sí se muestra el estado de carga, para no enseñar datos de otra sesión. | Spinner en cada clic. |
| 4 | Ordenación: primer clic `desc` en métricas y `asc` en dorsal/nombre/posición; el segundo clic invierte | Mismo criterio que la API y lo natural ("quién corrió más"). `aria-sort` en los encabezados para accesibilidad. | Siempre `asc`. |
| 5 | **Resaltado basado en las alertas del servidor** (`alerts` de `/metrics`), no recalculado en el cliente | Una sola fuente de verdad para los umbrales: la tabla, el gráfico y el reporte siempre coinciden. | Duplicar la lógica de umbrales en React. |
| 6 | Resaltado **no solo por color**: ámbar ▲ = warning, rojo ▲▲ = critical, texto oculto para lectores de pantalla, tooltip con el umbral y leyenda | Accesibilidad (daltonismo, WCAG 1.4.1). Los encabezados de métricas con umbral llevan un punto • y muestran el umbral al pasar el ratón. | Solo color de fondo. |
| 7 | RPE no reportado → "—" con tooltip "Not reported"; queda **fuera del gráfico** con una nota "N players not shown" | No se inventan valores ni se dibuja una barra en 0 que sugiera "esfuerzo nulo". | Mostrar 0. |
| 8 | Gráfico de **barras horizontales ordenadas de mayor a menor**, coloreadas por nivel de alerta, con **líneas de umbral** discontinuas | Con 12 nombres, el eje vertical los muestra completos; el orden facilita comparar; las líneas dejan ver qué tan lejos queda cada jugador del límite. | Barras verticales (nombres rotados, ilegibles). |
| 9 | El gráfico tiene su **propio selector de métrica**, independiente del orden de la tabla | La tabla es para explorar y el gráfico para comparar una métrica concreta. | Vincular el gráfico a la columna ordenada. |
| 10 | Panel de reporte con **cuatro estados**: vacío (instrucciones), carga (skeleton + mensaje, botón deshabilitado), error (mensaje + "Try again") y éxito | Es lo que pide el enunciado. Al regenerar se mantiene el reporte anterior atenuado. | — |
| 11 | Selectores de **idioma del reporte** (English por defecto, en línea con la UI) y **audiencia** (Coach / Players) | Exponen los parámetros `language` y `audience` del endpoint. Si se cambian tras generar, se avisa de que hay que regenerar. | Valores fijos. |
| 12 | El panel de reporte se monta con `key={sessionId}` | Al cambiar de sesión el reporte se reinicia y la petición en curso se cancela: nunca se muestra el reporte de otra sesión. | Limpiar el estado a mano. |
| 13 | Los destacados de respaldo se marcan como **"Data-based"**, y un pie indica proveedor, modelo, idioma y audiencia, además de que las alertas las calcula el código y no la IA | Transparencia sobre qué parte escribió la IA. | — |
| 14 | Errores con **mensaje en inglés según el código HTTP** y el detalle del servidor debajo ("Server detail") | La UI es en inglés y la API devuelve mensajes en español; así el texto principal es coherente y el detalle técnico no se pierde. | Mostrar solo el mensaje del servidor. |
| 15 | Formato de números `en-US` (10,488) y fechas en UTC (`Sep 19, 2026`) | Legibilidad; UTC evita que la fecha se desplace un día según la zona horaria del navegador. | — |
| 16 | Layout responsive: tabla con scroll horizontal y nombre del jugador fijo (sticky); gráfico y reporte en dos columnas en escritorio y apilados en móvil | Doce columnas no caben en un móvil; el nombre fijo mantiene el contexto al desplazarse. | Ocultar columnas en móvil. |
| 17 | Textos de respaldo del servidor con números formateados por idioma (`10.488` en es, `10,488` en en) | Se detectó en la revisión visual que salían sin separadores. | — |

### Verificación
- `npm run build`: correcto. Aviso de chunk > 500 kB por Recharts, aceptable para esta app (mejora posible: `import()` dinámico del gráfico).
- `npm test`: 25/25 en verde.
- **Prueba visual real**: se levantó la API con repositorios en memoria y el proveedor de IA `mock` (sin PostgreSQL) y se controló Edge en modo headless mediante Chrome DevTools Protocol:
  - La tabla carga la sesión más reciente con los umbrales resaltados (Molina: distancia 10,488 ▲, RPE 9 ▲, workload 810 ▲▲; Suárez: RPE "—").
  - Clic en "Workload" → orden descendente desde el servidor (Molina 810 primero, desempate por dorsal) y `aria-sort="descending"`.
  - "Generate report" → resumen, 2 destacados (fallback "Data-based", porque el mock no devuelve destacados) y 5 alertas (2 críticas primero) con sus umbrales.
  - Vista móvil (390 px) correcta. Sin errores en la consola.
- ⚠ No se probó con PostgreSQL ni con Gemini reales (credenciales pendientes).

### Pendiente
- Credenciales reales → `npm run db:setup` → probar de extremo a extremo con Gemini.
- Mejoras opcionales: tests de componentes (Vitest + Testing Library), code-splitting del gráfico y modo oscuro.

---

## Prompt 7 — Requisitos de la integración con IA

**Fecha:** 2026-11-10

**Instrucción:**
> Si se modificó el JSON de datos, hacer rollback: ese archivo no se modifica. Requisitos de la integración con IA ("la parte que más vamos a mirar"):
> - **Nada de datos inventados:** el reporte no puede mencionar jugadores o números que no existan en la sesión (salida estructurada, validación posterior o ambas).
> - **Contexto preciso:** qué datos se mandan, en qué formato y qué cálculos se hacen en el código en lugar de delegarlos en la IA.
> - **Datos incompletos:** jugadores con pocos minutos y valores `null`.
> - **Manejo de errores:** timeout, respuesta inválida del modelo y rate limit del proveedor.
> - **Seguridad:** API key por variable de entorno; nunca en el repositorio.
> - **Prompt versionado:** en el repo, en un archivo o módulo propio, fácil de leer.
>
> Además: registrar todas las decisiones consultadas en una sección propia del log, incluidas las anteriores.

### Verificación del JSON (sin rollback necesario)
- `apps/server/db/seeds/data.json` es **idéntico byte a byte** a `session_data.json` original (`cmp`), y no tiene cambios en git desde el primer commit. El archivo solo se copió; el seed lo **lee** y nunca lo escribe.

### Decisiones consultadas
C5, C6 y C7 (ver la sección "Decisiones consultadas y tomadas por mí", al principio del log).

### Flujo del reporte

```
POST /sessions/:id/report
  1. Datos de la sesión (repositorios)                                   ┐
  2. Alertas de umbral calculadas por código (alerts.js)                 │ determinista
  3. Contexto: agregados, comparaciones, rankings, calidad de los datos  │ (report-context.js)
  4. JSON Schema por sesión con player_id restringidos (enum)            ┘ (report-schema.js)
  5. Prompt versionado prompts/session-report.v1.md (+ idioma y audiencia)
  6. Llamada al proveedor ── errores transitorios: reintento con backoff (retry.js)
  7. Validación: estructura + jugadores + números + nombres (report-validator.js)
       └─ con problemas → 2.º intento con la lista exacta de problemas (sección RETRY)
  8. Ensamblado campo por campo: lo inválido → texto de respaldo verificado (report-fallback.js)
  9. Respuesta: report + dataQuality + meta (promptVersion, intentos, issues, fallbackFields, tokens)
```

### Decisiones

| # | Requisito | Decisión | Justificación | Alternativas descartadas |
| --- | --- | --- | --- | --- |
| 1 | Datos inventados | **Defensa en capas**: (a) salida estructurada con **JSON Schema** (`responseSchema` en Gemini); (b) el schema se genera **por sesión**, con `player_id` restringido por `enum` a los jugadores reales (y, en `alerts`, solo a los que tienen alerta); (c) **validación posterior** de todo, sin confiar en el proveedor. | El schema evita la mayoría de errores en origen; la validación cubre lo que el schema no puede expresar (texto libre) y a proveedores sin salida estructurada. | Solo pedir JSON en el prompt; confiar en el schema sin validar. |
| 2 | Datos inventados | **Validación del texto libre** (summary, reason, comment): cada número citado debe existir **literalmente** en el contexto enviado (se aceptan `10,488` / `10.488` / `29,6` y el redondeo a entero de un decimal), y cada nombre propio de dos o más palabras debe ser el nombre completo de un jugador de la sesión. | Detecta números inventados o calculados por el modelo ("superó por 61 AU"), jugadores inexistentes ("Lionel Messi") y atribuciones cruzadas ("Santiago Romero"). | Validar solo los `player_id` (no protege el texto). |
| 3 | Datos inventados | Un número con grupos de 3 dígitos (`11,000`) se interpreta **solo** como separador de miles. | Bug encontrado en los tests: `11,000` se leía también como `11.0`, que sí existía en los datos, y el número inventado pasaba. Los datos tienen como máximo 1 decimal. | — |
| 4 | Datos inventados | **Reintento con feedback**: si hay problemas, se hace un 2.º intento enviando la lista exacta ("the number "99,999" does not appear…") y la respuesta anterior. Se usa el intento con menos problemas. | Los modelos corrigen bien cuando se les dice qué está mal; cuesta como máximo una llamada más. | Reintentar sin feedback; no reintentar. |
| 5 | Datos inventados | **Respaldo campo por campo**: un campo que sigue siendo inválido se reemplaza por texto generado por código (`summarySource` / `source` / `commentSource: "fallback"`); los campos válidos de la IA se conservan. Un test verifica que los textos de respaldo **pasan el mismo validador** en las 3 sesiones y los 2 idiomas. | El reporte nunca contiene datos inventados y siempre está disponible. La UI marca esas partes como "Data-based". | Descartar todo el reporte; devolver error. |
| 6 | Contexto preciso | **El código calcula y el modelo redacta.** Se envían ya calculados: promedios del equipo, `distance_per_min`, `distance_vs_team_avg_pct`, `rankings` top 3 por métrica, alertas agrupadas por jugador con `threshold_reached`, `excess` y `excess_pct`, y contadores (`players_with_alerts`, `rpe_reported_by`…). | Los LLM fallan con la aritmética. Además, con la regla "solo números literales" (C6), todo número útil tiene que existir en el contexto. | Enviar solo las filas crudas. |
| 7 | Contexto preciso | Contexto en **JSON compacto con claves en `snake_case`** iguales al dataset, y una sección `data_quality` explícita. | Mismo vocabulario que los umbrales y las reglas del prompt; sin ambigüedad de unidades (`_m`, `_kmh`, `_au`). | Tabla en texto libre / CSV. |
| 8 | Contexto preciso | Las alertas siguen calculándose **en el código** (`alerts.js`) y son la fuente de verdad: el modelo solo comenta las que recibe. Un comentario sobre un jugador sin alerta se descarta. | Requisito explícito del enunciado y crítico para la salud del jugador. | Que el modelo detecte las alertas. |
| 9 | Datos incompletos | **RPE `null`**: `rpe_reported: false`, `workload_au: null`; no genera alerta; aparece en `data_quality.players_without_rpe`; el prompt prohíbe suponer un valor o interpretarlo como poco esfuerzo; la respuesta incluye `dataQuality` y la UI lo explica ("Data notes"). | No se puede afirmar nada sin el dato, pero tampoco se oculta que falta. | Imputar 0 o el promedio. |
| 10 | Datos incompletos | **Pocos minutos**: `low_minutes: true` si jugó **menos del 50 %** de la sesión (Franco Medina, 28 de 90). Los **promedios del equipo los excluyen** (`averages_exclude_low_minutes_players`), el prompt pide compararlos solo por minuto y no criticar sus totales, y el respaldo nunca los destaca por distancia total. | Un suplente de 28 min distorsiona el promedio y no es comparable por totales. Agustín Castro (62 min, 69 %) sí cuenta como jugador regular. | Tratarlos igual que al resto; normalizar todo a 90 min (inventa valores). |
| 11 | Errores | **Errores normalizados** en `AiProviderError` con `code`, independientes del proveedor: `timeout` → **504**, `rate_limit` → **429**, `unavailable` / `network` / `auth` / `invalid_response` → **502**, `config` → **500**. | El error handler y el frontend tratan igual a cualquier proveedor. | Propagar los errores crudos de Gemini. |
| 12 | Errores | **Rate limit**: se lee el tiempo de espera del proveedor (cabecera `Retry-After` o `google.rpc.RetryInfo` de Gemini, p. ej. `"17s"`). Si es ≤ `AI_RETRY_MAX_WAIT_MS` (5 s), se espera y se reintenta; si es mayor, se responde **429 con `Retry-After`** sin bloquear la petición, y la UI muestra "Try again in N seconds". | Respeta al proveedor y no deja al usuario esperando 30 s+ sin saber qué pasa. | Reintentar a ciegas; esperar siempre. |
| 13 | Errores | **5xx y red**: reintento con **backoff exponencial** (1 s, 2 s…), `AI_MAX_RETRIES=1`. **Timeout**: **no** se reintenta. | Los fallos transitorios suelen resolverse al reintentar; un timeout reintentado duplicaría la espera (2 × 30 s). | Reintentar también los timeouts. |
| 14 | Errores | **Respuesta inválida** (JSON roto, truncado por `MAX_TOKENS`, bloqueo de seguridad, vacía): se trata como problema de validación → reintento → respaldo. Se guarda `finishReason` para diagnóstico. `AI_MAX_OUTPUT_TOKENS` sube a 4096. | En Gemini 2.5 los tokens de "thinking" cuentan dentro del máximo: con 1024 el JSON podía cortarse. | 502 directo. |
| 15 | Seguridad | La API key solo existe en `apps/server/.env` (ignorado por git, **verificado**: `git ls-files` solo contiene `.env.example`); va en la cabecera `x-goog-api-key`, nunca en la URL; ningún mensaje de error ni log la incluye; el frontend nunca la ve (no hay variables `VITE_*`). | Requisito del enunciado; las URLs y los logs son los sitios donde más se filtran claves. | — |
| 16 | Seguridad | Los datos van en el mensaje de usuario y el prompt indica que **son información, no instrucciones**. El render de plantillas es de **una sola pasada**: un valor con `{{…}}` nunca se reinterpreta. | Mitigación de *prompt injection* a través de los datos (p. ej. un nombre de jugador malicioso). | — |
| 17 | Prompt versionado | `apps/server/prompts/session-report.v1.md` con front matter (`version`), secciones `## SYSTEM`, `## USER`, `## RETRY`, `## LANGUAGE es/en`, `## AUDIENCE coach/player` y `{{placeholders}}`. Lo carga `src/prompts/prompt-loader.js`, que **falla si falta una variable**. La versión se elige con `REPORT_PROMPT_VERSION` y se devuelve en `meta.promptVersion`. | Elección C7. Cambiar el prompt = crear `v2.md`, sin tocar código; cada reporte es trazable a su prompt. | Prompt embebido en el código. |
| 18 | Trazabilidad | `meta` incluye `promptVersion`, `attempts`, `validation.issues` por intento, `fallbackFields` y tokens totales. | Permite auditar y depurar cada reporte, y medir el coste. | — |

### Verificación
- `npm test`: **40/40** en verde (antes 25). Nuevos tests:
  - **Grounding**: formatos numéricos es/en, números inventados y calculados, nombres inventados ("Lionel Messi") y cruzados ("Santiago Romero").
  - **Flujo**: respuesta válida en 1 intento; número inventado → reintento con feedback → corregido; doble fallo → respaldo campo por campo; texto que no es JSON → reporte completo de respaldo.
  - **Proveedor**: rate limit corto (espera y reintenta) y largo (429 + `Retry-After: 60`); timeout → 504 sin reintento; 5xx persistente → 502 tras reintentar.
  - **Gemini**: `responseSchema` con tipos en mayúsculas y `enum`; `RetryInfo`; mapeo de 429 / 503 / 403 / bloqueo / timeout / red.
  - **Calidad y prompt**: marcas de pocos minutos y RPE nulo; los textos de respaldo pasan el validador (3 sesiones × 2 idiomas); el prompt versionado tiene todas sus secciones y no deja placeholders sin resolver.
- **El validador atrapó un error real durante el desarrollo**: el test de "respuesta válida" citaba un promedio de 7,017 m escrito de memoria; el validador lo rechazó porque el promedio real enviado era 6,868 m.
- Prueba visual (API de demo con el proveedor `mock` + Edge headless): el reporte muestra el aviso de respaldo, las notas de calidad de datos (Mateo Suárez sin RPE; Franco Medina, 28 min) y las etiquetas "Data-based". Sin errores en la consola.
- ⚠ Sigue pendiente probar con Gemini real (falta `GEMINI_API_KEY`) y con PostgreSQL real (credenciales).

### Pendiente
- Probar con Gemini real y revisar cuántos reportes necesitan reintento o respaldo (`meta.validation`) para ajustar el prompt en una `v2`. ✅ Primera prueba en el Prompt 8.

---

## Prompt 8 — Prueba de las conexiones reales (PostgreSQL y Gemini)

**Fecha:** 2026-11-10

**Instrucción:**
> Las credenciales de Gemini y de la base de datos ya deberían estar configuradas: testear ambas conexiones. (Durante la prueba: "no leas nunca el .env").

### Resultados

| Conexión | Resultado | Detalle |
| --- | --- | --- |
| PostgreSQL | ❌ Falla | `28P01 password authentication failed` para el usuario configurado. PostgreSQL no distingue entre "el usuario no existe" y "la contraseña es incorrecta", así que hay que verificar ambas cosas desde `psql` o pgAdmin. |
| Gemini: autenticación | ✅ OK | La API key es válida: se listaron los modelos disponibles para la cuenta. |
| Gemini: `gemini-2.5-flash` | ❌ 404 | "no longer available to new users". |
| Gemini: `gemini-3.8-flash` | ❌ Timeout | Sin respuesta en 30 s ni en 120 s (alta demanda). |
| Gemini: `gemini-flash-latest` / `gemini-3.5-flash` | ❌ 503 | "This model is currently experiencing high demand". |
| Gemini: `gemini-3.1-flash-lite` | ✅ OK | ~1,6 s con un prompt mínimo. |
| **Reporte real de punta a punta** (sesión 103, datos del JSON en memoria) | ✅ OK | `es/coach` en 2,9 s y `en/player` en 2,4 s; **1 intento, validación superada, 0 campos de respaldo**. Todos los números citados existen en los datos (10488 m, 29 sprints, 32.4 km/h, 554 AU) y los rankings mencionados son correctos. El reporte para jugadores le recuerda a Mateo Suárez que reporte su RPE sin inventarle un valor. Las alertas para jugadores se plantean como consejos de recuperación, según la audiencia. |

### Decisiones

| # | Decisión | Justificación |
| --- | --- | --- |
| 1 | Modelo por defecto: **`gemini-3.1-flash-lite`** (consulta C8) | Es el único Flash que respondía de forma fiable; su calidad se comprobó con reportes reales. Se cambia con `GEMINI_MODEL`. |
| 2 | La prueba de Gemini se hizo **sin depender de la BD**: servicio de reporte real + repositorios en memoria alimentados por el mismo JSON | La BD seguía fallando; así se valida la integración con IA de forma aislada. |
| 3 | El modelo de prueba se pasó por **variable de entorno en la línea de comandos**, que tiene prioridad sobre el `.env` | Respeta la regla D11: no se lee ni se modifica el `.env` del usuario. |
| 4 | Las pruebas de credenciales solo informan **el resultado de la conexión** | Tras D11 no se inspecciona el `.env` de ninguna forma; los valores los verifica el usuario. |

### Pendiente
- Corregir las credenciales de PostgreSQL (usuario y contraseña) y ejecutar `npm run db:setup`.
- Poner `GEMINI_MODEL=gemini-3.1-flash-lite` en el `.env` (o borrar esa línea para usar el valor por defecto).

---

## Prompt 9 — Comando para crear una base de datos

**Fecha:** 2026-11-10

**Instrucción:**
> Dame el comando para crear una db.

### Decisiones

| # | Decisión | Justificación |
| --- | --- | --- |
| 1 | Se recomienda **`npm run db:create`** del proyecto, y como alternativa manual `createdb` / `CREATE DATABASE` | El script del proyecto es idempotente (no falla si la base ya existe), usa las credenciales del `.env` y es lo que ejecutará quien evalúe el proyecto. |
| 2 | El asistente **no ejecuta** la creación | Lo hace el usuario en su terminal con sus credenciales (regla D11: no se lee el `.env`). |

---

## Prompt 10 — Nueva prueba de conexión tras crear la base

**Fecha:** 2026-11-10

**Instrucción:**
> Ya creé la db, testea de nuevo la conexión.

### Resultado
- `npm run db:setup` y `npm run db:migrate` siguen fallando con `28P01 password authentication failed` para el usuario `admin`, también al conectar directamente a la base `oliver`.
- Conclusión: el problema no es la base de datos, sino la **autenticación del usuario**. La combinación usuario/contraseña del `.env` no coincide con la del servidor PostgreSQL al que apunta (`localhost:5432`).

### Decisiones

| # | Decisión | Justificación |
| --- | --- | --- |
| 1 | No se inspecciona el `.env` para depurar (D11); se le da al usuario una prueba con `psql` usando **exactamente** los mismos parámetros que la app | Si `psql` conecta y la app no, el problema está en el `.env`; si `psql` tampoco conecta, está en el usuario o la contraseña del servidor. Así se aísla la causa sin ver secretos. |

---

## Prompt 11 — Cómo verificar los usuarios de la base de datos

**Fecha:** 2026-11-10

**Instrucción:**
> ¿Cómo verifico los usuarios que existen para esa db? Puede que no lo haya creado todavía.

### Decisiones

| # | Decisión | Justificación |
| --- | --- | --- |
| 1 | Aclarar que en PostgreSQL los usuarios (roles) son del **servidor**, no de cada base; por base de datos lo que existe son **permisos** | Evita buscar a `admin` "dentro" de `oliver`. Probable causa del error `28P01`: el rol `admin` no existe todavía. |
| 2 | Dar comandos para listar roles (`\du` / `pg_roles`), ver permisos sobre `oliver` (`\l oliver`, `has_database_privilege`) y crear el rol con `CREATEDB` y como dueño de `oliver` | Con `CREATEDB`, el script `db:create` puede funcionar; siendo dueño de la base, `db:migrate` puede crear las tablas. |

---

## Prompt 12 — Crear el usuario `admin`

**Fecha:** 2026-11-10

**Instrucción:**
> No sale el usuario admin, ¿cómo lo creo?

### Diagnóstico
Confirmado: el rol `admin` **no existía** en el servidor. Esa era la causa del error `28P01` de los Prompts 8 y 10 (PostgreSQL da el mismo mensaje para "usuario inexistente" que para "contraseña incorrecta").

### Decisiones

| # | Decisión | Justificación | Alternativas descartadas |
| --- | --- | --- | --- |
| 1 | Crear un **rol dedicado** `admin` con `LOGIN` + `CREATEDB` (sin `SUPERUSER`) y hacerlo **dueño** de `oliver` | Principio de mínimo privilegio: la app puede crear la base, sus tablas y sus datos, pero no administrar el servidor. | Usar el superusuario `postgres` en la app. |
| 2 | En PostgreSQL 15+ el esquema `public` ya no es escribible por cualquiera: al ser dueño de la base también se cambia el dueño del esquema `public` | Sin esto, `db:migrate` fallaría con `permission denied for schema public`. | — |

---

## Prompt 13 — Prueba de conexión con la base de datos real

**Fecha:** 2026-11-10

**Instrucción:**
> Listo, ya está creado [el usuario `admin`], ahora comprueba la conexión con la db.

### Resultados contra PostgreSQL real

| Prueba | Resultado |
| --- | --- |
| `npm run db:setup` | ✅ Base existente detectada, migración `001_initial_schema.sql` aplicada, seed: 1 equipo, 12 jugadores, 3 sesiones, 36 métricas, 4 umbrales. |
| Seed ejecutado por segunda vez | ✅ Mismo resultado, sin duplicados (UPSERT idempotente). |
| `GET /health` | ✅ `{"status":"ok","database":"oliver"}` |
| `GET /sessions` | ✅ 3 sesiones, de la más reciente a la más antigua; fechas `YYYY-MM-DD` sin desplazamiento por zona horaria. |
| `GET /sessions/103/metrics?order_by=total_distance_m&order=desc` | ✅ Molina 10488 → Acosta 8840 → Romero 8512; `max_speed_kmh` llega como `number` (no string de `NUMERIC`). 5 alertas (2 críticas). |
| `?player_id=9` | ✅ Mateo Suárez con `rpe: null` y `workload_au: null` (la columna generada de PostgreSQL maneja el `null`). |
| `?order_by=rpe&order=desc` | ✅ Molina (9) primero, Suárez (`null`) último: `NULLS LAST`. |
| Errores | ✅ `404` para la sesión 999 y `400` para un `order_by` inválido, con mensaje claro. |
| `POST /sessions/:id/report` con el `.env` del usuario | ❌ `404` de Gemini: el `.env` todavía tiene `GEMINI_MODEL=gemini-2.5-flash` (retirado). |
| Reporte con `GEMINI_MODEL=gemini-3.1-flash-lite` (pasado por línea de comandos) | ✅ Sesiones 101, 102 y 103 (es/en, coach/player): **1 intento, validación superada, 0 respaldos** en todos los casos; ~2–8 s. Se comprobaron a mano los datos citados (p. ej. 640 m de alta velocidad de Castro en la 101, 30.8 km/h de Acosta en la 102). |
| Timeout puntual | ⚠ Una llamada a la sesión 103 superó los 30 s y devolvió `504`; al repetirla respondió en 8,4 s y 2,3 s. Es latencia variable del proveedor; el sistema respondió como se diseñó (504 sin reintento; la UI muestra "Try again"). |

### Pendiente
- Cambiar en `apps/server/.env` `GEMINI_MODEL=gemini-3.1-flash-lite` (o borrar la línea) para que `npm run dev` use el modelo elegido en C8.

---

## Prompt 14 — Resumen de cambios pendientes y nombre del commit

**Fecha:** 2026-11-10

**Instrucción:**
> Explica con bullet points todos los cambios que tenemos sin commitear y dame un nombre para el commit.

### Decisiones

| # | Decisión | Justificación |
| --- | --- | --- |
| 1 | Revisar el estado con `git status` / `git diff --stat` y escanear los archivos pendientes en busca de secretos antes de proponer el commit | Verificar que no se cuela ninguna API key ni contraseña. Resultado: ninguno; `.env` no aparece (está ignorado) y `data.json` no tiene cambios. |
| 2 | Nombre en formato **Conventional Commits** (`feat: …`), en español como el resto del proyecto | Convención estándar y legible en el historial. |
| 3 | El asistente **propone** el commit pero no lo ejecuta | Los commits los hace el usuario o se piden explícitamente. |

---

## Prompt 15 — Aclaración del término "API de sesiones"

**Fecha:** 2026-11-10

**Instrucción:**
> ¿A qué se refiere con "API de sesiones"?

### Decisiones

| # | Decisión | Justificación |
| --- | --- | --- |
| 1 | Aclarar que "sesión" es la **entidad del dominio** (un entrenamiento o un partido, tabla `sessions`), no una sesión de usuario o de login | El término es ambiguo en desarrollo web; en este proyecto no hay autenticación. |
| 2 | Proponer un nombre de commit más explícito: `feat: endpoints de sesiones de entrenamiento/partido, frontend de revisión y reporte de IA validado` | Evita la confusión con "sesión de usuario" para quien lea el historial. |

---

## Prompt 16 — Conectar el repositorio con GitHub

**Fecha:** 2026-11-10 · *Registrado a posteriori: durante este prompt el log estaba en pausa (D12).*

**Instrucción:**
> ¿Cómo hago para conectar mi repo con mi cuenta de GitHub?

### Estado encontrado
Sin remoto configurado, rama local `master`, GitHub CLI (`gh`) no instalada.

### Decisiones

| # | Decisión | Justificación |
| --- | --- | --- |
| 1 | Dos caminos: **(A)** crear el repo en github.com y `git remote add origin` + `git push -u origin main`; **(B)** `winget install GitHub.cli` + `gh auth login` + `gh repo create --source=. --push` | A no requiere instalar nada; B lo hace todo en un comando. |
| 2 | Crear el repo **sin** README / .gitignore / licencia en GitHub | Evita un commit remoto que choque con el historial local. |
| 3 | Sugerir renombrar `master` → `main` (`git branch -M main`) | Es el nombre por defecto en GitHub. |
| 4 | Recordar que `.env` está en `.gitignore` y que hay que commitear los cambios pendientes antes del push | Las credenciales no se suben, y se sube el trabajo completo. |

---

## Prompt 17 — Descripción del proyecto

**Fecha:** 2026-11-10 · *Registrado a posteriori (D12).*

**Instrucción:**
> Genera una descripción del proyecto.

### Decisiones

| # | Decisión | Justificación |
| --- | --- | --- |
| 1 | Entregar una versión **corta** para el campo "About" de GitHub (en español e inglés) más *topics*, y una versión **completa** en bullets | Encaja con el contexto (conectar con GitHub) y sirve para el README o la presentación. |
| 2 | Destacar en la descripción la **validación anti-alucinación** del reporte | Es el punto que el enunciado dice que más se va a evaluar. |
| 3 | No escribirla en ningún archivo sin pedirlo | El usuario la usará donde decida. |

---

## Prompt 18 — Cómo correr el proyecto en local

**Fecha:** 2026-11-10 · *Registrado a posteriori (D12).*

**Instrucción:**
> No agregues más nada a log.md hasta que te diga lo contrario. ¿Cómo hago para correr el proyecto en local?

### Decisiones

| # | Decisión | Justificación |
| --- | --- | --- |
| 1 | Pasos mínimos: revisar `.env` (en especial `GEMINI_MODEL=gemini-3.1-flash-lite`) → `npm install` → `npm run db:setup` (solo la 1.ª vez) → `npm run dev` → `http://localhost:5173` | Es el flujo real verificado en los Prompts 8–13. |
| 2 | Incluir una tabla de problemas frecuentes (API caída, BD no disponible, 404 del modelo, timeout puntual) y `AI_PROVIDER=mock` para probar sin gastar cuota | Son los errores que ya aparecieron durante el desarrollo. |

---

## Prompt 19 — Layout apilado, paleta de OLIVER y propuesta de librería de componentes

**Fecha:** 2026-11-10

**Instrucción:**
> Ahora todo lo que mencioné lo puedes agregar al log.md. Haz que el componente "Metric by player" y el "AI session report" estén uno debajo de otro con CSS flex. Para el proyecto utiliza la paleta de colores de https://oliversports.ai/es/ en todo el frontend y sus componentes. Haz una propuesta de librerías de componentes para sustituir los componentes visuales actuales, a modo de que la app quede más moderna.

### Obtención de la paleta
La herramienta de lectura web convierte la página a markdown y pierde el CSS, así que se descargaron el HTML y sus hojas de estilo (`/css/main.css`, `/css/pages/oliver-sports.css`) y se leyeron las variables reales:

| Variable / uso en el sitio | Valor | Rol en la app |
| --- | --- | --- |
| `--dark-blue`, fondos de hero y footer | `#001c26` → degradado `#003c51` | Fondo de página y header |
| `--blue` | `#2378f8` | Color principal (barras, selección, foco) |
| Botón primario (degradado) | `#184b96` → `#2378f8` | Botón "Generate report" |
| `--pink` | `#e04080` | Acento (badge "Match", estrellas de destacados) |
| Botón CTA amarillo | `#f9b82c` / `#ffc94d` | Nivel **warning** |
| Texto sobre fondo oscuro (FAQ) | `#d9e5fa` | Texto secundario |
| Tipografía | Rubik | Fuente de toda la app |
| `--border-radius` | `30px` | Botones, selects y controles en forma de píldora |

### Decisiones

| # | Decisión | Justificación | Alternativas descartadas |
| --- | --- | --- | --- |
| 1 | Gráfico y reporte en un contenedor **`flex flex-col gap-6`** (antes `grid lg:grid-cols-2`) | Pedido explícito (D13). Además le da al gráfico todo el ancho y al reporte espacio para leerse sin columnas estrechas. | — |
| 2 | Paleta como **tokens semánticos** en el `@theme` de Tailwind v4 (`ink`, `surface`, `line`, `fg`, `soft`, `muted`, `brand`, `accent`, `warning`, `critical`, `success`) | Los componentes usan nombres de rol, no hex sueltos: cambiar la paleta es tocar un solo archivo (`index.css`). Se verificó con `grep` que **no queda ningún color de Tailwind por defecto** (slate, indigo…) en el frontend. | Reemplazar hex a mano en cada componente. |
| 3 | **Tema oscuro** (consulta C9) con fondo degradado navy, tarjetas translúcidas con `backdrop-blur` y header fijo | Coherente con el sitio de la marca. | Tema claro. |
| 4 | Warning = amarillo de marca, Critical = **rojo estándar** (consulta C10), con variantes `*-fg` más claras para el texto sobre fondo oscuro | Mantiene el significado universal de "peligro" y asegura el contraste en tema oscuro. Se conservan ▲ / ▲▲ para no depender solo del color. | Rosa como critical. |
| 5 | Controles en **píldora** (radio 30px) y botón primario con el **degradado azul** de los botones del sitio (`PrimaryButton`) | Mismo lenguaje visual que la marca. | — |
| 6 | Recharts recibe los mismos valores de los tokens (objeto `COLORS` documentado) para barras, ejes, grilla y tooltip | Recharts dibuja SVG y necesita colores concretos; se centralizan en un solo objeto. | — |
| 7 | `color-scheme: dark` en `:root` | Selects nativos, scrollbars y controles del navegador también en oscuro. | — |
| 8 | Se mantiene el nombre del proyecto "Oliver" en el header, **sin imitar el logotipo** de la marca | Se usa la paleta, no la identidad gráfica de la empresa. | Reproducir el logo "OLIVER." |
| 9 | La librería de componentes se entrega como **propuesta**, sin implementar | Se pidió una propuesta; adoptar una librería es una decisión del usuario (regla de consulta). | Migrar directamente. |

### Propuesta de librerías de componentes

**Criterios:** compatible con **React 19 + Tailwind v4** (ya en el proyecto), admite el **tema de marca** mediante tokens, es **accesible** (teclado, ARIA), es moderna visualmente y no duplica la librería de gráficos.

| Opción | Qué es | A favor | En contra |
| --- | --- | --- | --- |
| **1. shadcn/ui** ⭐ *recomendada* | Componentes sobre **Radix UI** + Tailwind que se **copian al repo** (no es una dependencia cerrada) | Usa Tailwind v4 y variables CSS, así que mapea directo a nuestros tokens; su `Chart` está **construido sobre Recharts** (se conserva); `DataTable` con **TanStack Table** admite orden **manual en servidor**; es la referencia actual en apps React modernas. | Más archivos en el repo (los componentes quedan en `components/ui/`). |
| 2. Tremor | Librería orientada a **dashboards** (Tailwind + Recharts) | KPI cards, charts y tablas de analítica listos; estética "dashboard" moderna. | Catálogo más acotado (menos primitivas como Select o Toggle avanzados); el tema oscuro y la marca requieren más ajuste. |
| 3. HeroUI (ex NextUI) | Librería completa sobre Tailwind con animaciones | Muy vistosa y con buen tema oscuro de serie; `Table` con orden incluido. | Añade un provider y un plugin de tema propios; personalizar la marca a fondo es más trabajoso. |
| 4. Mantine (+ Mantine Charts) | Librería completa con su propio sistema de estilos | Enorme catálogo, excelente tema oscuro, charts sobre Recharts. | **No usa Tailwind**: convivirían dos sistemas de estilos o habría que reescribir todo. |
| 5. MUI | Material Design | Muy madura. | Estética Material poco "moderna" para esta marca, pesada, y su sistema de estilos choca con Tailwind. |

**Mapeo con shadcn/ui (recomendada):**

| Componente actual | Sustituto | Mejora |
| --- | --- | --- |
| `<select>` nativo (sesión, métrica) | `Select` (Radix) | Menú desplegable estilizado en oscuro, con búsqueda por teclado. |
| `MetricsTable` | `DataTable` (TanStack Table, `manualSorting`) | Encabezados ordenables accesibles, columnas fijas, se mantiene el orden en el servidor. |
| `title=` en celdas con umbral | `Tooltip` (Radix) | Tooltips reales, con estilo y accesibles (los `title` nativos no se ven en táctil). |
| `Segmented` | `ToggleGroup` | Mismo control, con foco y teclado de Radix. |
| `Card`, `LevelBadge`, `Spinner`/skeleton | `Card`, `Badge` (variantes warning/critical), `Skeleton` | Consistencia visual. |
| `ErrorState` | `Alert` + `Sonner` (toasts) | Errores del reporte como toast no intrusivo. |
| `MetricChart` | `ChartContainer` + `ChartTooltip` (Recharts) | Colores por variables CSS (sin el objeto `COLORS` duplicado) y tooltip consistente. |
| Glifos ▲ / ★ / ✦ | Iconos `lucide-react` | Iconografía coherente. |

### Verificación
- `npm run build`: correcto. `grep` sin colores fuera de la paleta.
- Prueba visual (API de demo + Edge headless): tema oscuro, tabla con resaltado amarillo y rojo, gráfico a ancho completo, reporte debajo con controles en píldora; orden por columna funcionando. Sin errores en la consola.

### Pendiente
- Que el usuario elija la librería de componentes (o ninguna) para implementar la migración. ✅ Elegida shadcn/ui (Prompt 20).

---

## Prompt 20 — Migración del frontend a shadcn/ui

**Fecha:** 2026-11-10

**Instrucción:**
> Utiliza shadcn/ui para los componentes: instala la librería y sustituye los componentes actuales por componentes de shadcn/ui.

### Componentes sustituidos

| Antes (propio) | Ahora (shadcn/ui) |
| --- | --- |
| `<select>` nativo (sesión y métrica) | `Select` (Radix) con `Label`; el de sesión muestra fecha, título y un `Badge` con el tipo |
| Tabla HTML con encabezados-botón | **Data table**: `Table` + **TanStack Table v8** con `manualSorting` (el orden sigue resolviéndose en el servidor) y encabezados `Button` ghost con iconos de orden |
| Atributos `title=` en celdas y encabezados | `Tooltip` (Radix, accesible con teclado y visible en táctil) |
| `Card` propio | `Card` / `CardHeader` / `CardTitle` / `CardDescription` / `CardAction` / `CardContent` |
| `Segmented` propio | `ToggleGroup` (`type="single"`) |
| Botón con clases a mano | `Button` con el degradado azul de marca y forma de píldora |
| `LevelBadge` / etiquetas | `Badge` con variantes nuevas `warning`, `critical`, `brand` y `pink` |
| Spinner y skeleton propios | `Skeleton` + `Loader2` de lucide |
| Caja de error / avisos | `Alert` (destructive / informativo / éxito) |
| Gráfico Recharts "suelto" | `ChartContainer` + `ChartTooltip` de shadcn (sigue usando Recharts) |
| Glifos ▲ ▲▲ ★ ✦ | Iconos `lucide-react` (`TriangleAlert`, `OctagonAlert`, `Star`, `Sparkles`…) |
| — | `Sonner`: toasts de "Report generated" y de error |

### Decisiones

| # | Decisión | Justificación | Alternativas descartadas |
| --- | --- | --- | --- |
| 1 | Configuración manual (`components.json` con `tsx: false`, alias `@/` en Vite y en `jsconfig.json`) y luego `npx shadcn add …` | El proyecto es JavaScript; el CLI genera los componentes en `.jsx`. | Migrar a TypeScript solo para usar shadcn. |
| 2 | **Sustituir el paquete npm `cn`** que el CLI añadió por el estándar de shadcn: `src/lib/utils.js` con `clsx` + `tailwind-merge` | El CLI, al no haberse ejecutado `init`, resolvió `cn` a un paquete npm poco conocido. Por **seguridad de la cadena de suministro** y por convención se usan las dependencias estándar que cualquier desarrollador de shadcn espera. | Mantener el paquete `cn`. |
| 3 | Quitar `next-themes` y fijar `theme="dark"` en `Sonner` | La app es solo tema oscuro (C9); esa dependencia sobraba. | — |
| 4 | Fijar **`@tanstack/react-table` en v8** | npm instaló la v9, cuya API cambia respecto a la que documenta el `DataTable` de shadcn. | v9. |
| 5 | **Tema de marca en las variables estándar de shadcn** (`--background`, `--card`, `--primary`, `--muted-foreground`, `--border`, `--ring`, `--chart-1..5`…) + tokens propios (`soft`, `pink`, `warning`, `critical`, `success`, `brand-deep`) | Los componentes de shadcn heredan la paleta de OLIVER sin tocar su código. Los tokens propios antiguos `accent` y `muted` se **renombraron** porque chocaban con el significado que tienen en shadcn (fondo de hover y fondo atenuado). | Editar las clases de cada componente de shadcn. |
| 6 | Personalizar los componentes generados donde hace falta (variantes de `Badge`, `Sonner`) | Es el modelo de shadcn: el código vive en el repo para adaptarlo. | — |
| 7 | Niveles de alerta con **icono de forma distinta** (triángulo = warning, octógono = critical) además del color | Accesibilidad: no depender solo del color (sustituye a ▲ / ▲▲). | — |
| 8 | Unidades **debajo** del nombre en los encabezados de la tabla | Con los botones de shadcn las 11 columnas no entraban en escritorio (Workload quedaba cortada). | Ocultar columnas. |
| 9 | En móvil, los controles del reporte (`CardAction`) bajan **debajo del título**; desde `md` quedan a la derecha | En 390 px el título quedaba aplastado en una columna estrecha. | — |
| 10 | El `Select` de sesión siempre controlado (`""` hasta que llega la sesión por defecto) | Se detectó en la prueba un warning de React (uncontrolled → controlled). | — |
| 11 | Toasts **además** del estado inline del reporte | El toast confirma la acción aunque el panel esté fuera de pantalla; el estado inline (carga, error, vacío) se mantiene porque lo pide el enunciado. | Solo toasts. |

### Verificación
- `npm run build`: correcto. `npm test`: 40/40.
- Prueba en navegador (API de demo + Edge headless por DevTools Protocol): ordenar por Workload (servidor, `aria-sort="descending"`); cambiar de sesión con el `Select` de Radix **usando el teclado**; generar el reporte → toast "Report generated" y contenido; capturas en escritorio (1440 px, las 11 columnas visibles) y en móvil (390 px). **Sin errores ni warnings en la consola** tras corregir el `Select`.

### Pendiente
- Probar con `npm run dev` y Gemini real una vez actualizado `GEMINI_MODEL` en el `.env`.

---

## Prompt 21 — Select de sesión, diseño responsive, README del enunciado, leyenda y commits

**Fecha:** 2026-11-10

**Instrucciones (en un mismo turno):**
> 1. El Select de sesión queda cortado y no se visualiza correctamente: ampliar su ancho. Después, hacer que la app se vea responsive.
> 2. Asegurar que el README incluya: cómo instalar y correr el proyecto (backend, frontend y seed), qué modelo de IA se usó y por qué, las decisiones de diseño principales y sus trade-offs, qué se mejoraría con más tiempo, y si se usaron herramientas de IA para programar y cómo.
> 3. Separar los cambios implementados en varias partes para subirlos en varios commits.
> 4. Agregar una leyenda con todos los conceptos, en un dialog, según la tabla "Referencia de campos" del enunciado.

### Decisiones consultadas
C11 (ver la sección "Decisiones consultadas y tomadas por mí").

### Decisiones

| # | Decisión | Justificación | Alternativas descartadas |
| --- | --- | --- | --- |
| 1 | **Select de sesión:** la causa era una clase propia `sm:w-96` (384 px fijos). En escritorio el trigger ahora **se ajusta al contenido** (`w-auto`, mínimo 24 rem); en móvil y tablet ocupa el ancho completo y el texto puede **pasar a otra línea** en vez de cortarse. | Verificado: contenido de 389 px dentro de un trigger de 437 px, sin recorte. | Truncar con "…" (se pierde el título). |
| 2 | `data-[size=default]:h-auto` en el trigger | El `SelectTrigger` de shadcn fija `h-9` con un selector de datos que ganaba a `h-auto`; el texto en dos líneas se superponía con la etiqueta (detectado en la captura de móvil). | — |
| 3 | **Breakpoints:** tabla desde `lg` (1024 px); por debajo, tarjetas (1 columna en móvil, 2 en tablet). Header en fila desde `lg`. | A 820 px (tablet) la tabla de 11 columnas todavía necesitaba scroll. | Tabla desde `md`. |
| 4 | Header **fijo solo desde `md`** | En móvil un header fijo con el selector ocupa una parte grande de la pantalla. | Siempre fijo. |
| 5 | Gráfico en modo compacto (< 640 px): eje Y de 84 px, nombres abreviados ("S. Molina"), 3 marcas en el eje X; con un hook `useMediaQuery` (`useSyncExternalStore`) | Recharts necesita valores numéricos, no clases CSS; con 124 px de eje las barras quedaban muy cortas en 390 px. | Ocultar el gráfico en móvil. |
| 6 | Paddings y espaciados reducidos en móvil; botón "Generate report" a ancho completo en móvil | Más espacio útil y un objetivo táctil más grande. | — |
| 7 | La descripción de la tarjeta de métricas pasa a "Sortable by any metric (sorted on the server)…" | "Click a column header" no aplica en la vista de tarjetas. | — |
| 8 | **README reorganizado** con las cinco secciones pedidas al principio (instalación; modelo de IA y por qué; decisiones y trade-offs; mejoras con más tiempo; uso de herramientas de IA) y la referencia técnica al final | Que quien evalúe encuentre primero lo que pide el enunciado. La sección de uso de IA es transparente: Claude Code + Claude Opus 5.5, cómo se dirigió, qué se decidió y cómo se verificó. | Añadir secciones al final del README existente. |
| 9 | **Leyenda** como `Dialog` de shadcn, abierta desde un botón "Legend" en la tarjeta de métricas. Muestra: las 8 métricas con su descripción (de la referencia de campos del enunciado, centralizada en `metrics.js`), la tabla de **umbrales reales de la sesión** y los indicadores (Warning, Critical, sin dato, pocos minutos, "Data-based", tipo de sesión). | Una sola fuente para etiquetas y descripciones; los umbrales se leen de la API, no se repiten a mano. | Leyenda fija bajo la tabla (ya existe una versión corta); umbrales hardcodeados. |
| 10 | El CLI de shadcn volvió a añadir el paquete npm `cn` al instalar `dialog`: se reemplazó otra vez por `@/lib/utils` y se desinstaló | Mismo criterio que el Prompt 20 (cadena de suministro y convención). Es un comportamiento recurrente del CLI con esta configuración: **revisar los imports cada vez que se añade un componente**. | — |
| 11 | **Commits separados** de lo pendiente, cada uno funcional por sí solo: `feat(client): componentes shadcn/ui, paleta de marca y diseño responsive` → `feat(client): leyenda … en un dialog` → `docs: README … y registro de decisiones`. El commit 1 se verificó aislado (`git stash` del resto + build + tests). | El backend y la capa de IA ya estaban en `810aedd`, **publicado en `origin/main`** por el usuario: separarlo exigiría reescribir el historial público (force push), así que no se tocó. `App.jsx` mezclaba cambios de los commits 1 y 2: se preparó temporalmente una versión sin la leyenda para que el commit 1 no importara un archivo inexistente. | Reescribir `810aedd` con force push; un solo commit. |

### Verificación
- `npm run build` y `npm test` (40/40) correctos.
- Navegador headless a **1440 px, 820 px y 390 px**: sin scroll horizontal en la página; 12 tarjetas en móvil; orden por Workload desde el Select móvil en ambos sentidos (Molina primero en desc, Medina en asc, Suárez con `null` al final); Select de sesión sin recorte; la leyenda abre con 14 conceptos y 4 filas de umbrales y se cierra con Escape. **Sin errores ni warnings en la consola.**
