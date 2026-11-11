// Validación de la respuesta del modelo contra los datos reales de la sesión.
//
// "Nada de datos inventados" se comprueba en tres niveles:
//  1. Estructura: JSON válido con summary / highlights / alerts.
//  2. Jugadores: todo player_id existe en la sesión (y en las alertas, solo los que tienen alerta).
//  3. Texto libre (summary, reason, comment):
//     - cada número citado debe existir literalmente en el contexto enviado
//       (se aceptan formatos 10,488 / 10.488 / 29,6 y el redondeo a entero de un decimal);
//     - cada nombre propio de dos o más palabras debe ser el nombre completo de un jugador de la
//       sesión (detecta nombres inventados y combinaciones incorrectas como "Santiago Romero").

// Números pequeños de uso narrativo ("2 o 3 jugadores", "escala 1-10").
const NARRATIVE_INTEGERS = Array.from({ length: 11 }, (_, i) => i);

// Palabras con mayúscula inicial que no son nombres (inicio de frase, conectores...).
const STOPWORDS = new Set([
  'El', 'La', 'Los', 'Las', 'Un', 'Una', 'Unos', 'Unas', 'Lo', 'Al', 'Del', 'De', 'En', 'Con', 'Por', 'Para', 'Sin', 'Y',
  'Pero', 'Hoy', 'Este', 'Esta', 'Estos', 'Estas', 'Además', 'También', 'Mientras', 'Destacan', 'Destaca', 'Según',
  'The', 'A', 'An', 'In', 'On', 'With', 'For', 'Of', 'By', 'And', 'But', 'Today', 'This', 'These', 'Also', 'While',
  'Both', 'Coach', 'Players', 'Team', 'Equipo', 'Jugadores', 'Entrenador',
]);

// Términos del dominio que el modelo puede escribir con mayúsculas ("High-Speed Running").
// Una secuencia con alguno de ellos no se considera un nombre de persona.
const DOMAIN_WORDS = new Set([
  'High', 'High-Speed', 'Speed', 'Running', 'Distance', 'Total', 'Max', 'Maximum', 'Sprint', 'Sprints', 'Load',
  'Workload', 'Training', 'Match', 'Session', 'Rate', 'Perceived', 'Exertion', 'Accelerations', 'Average', 'Recovery',
  'Alta', 'Velocidad', 'Distancia', 'Carga', 'Máxima', 'Promedio', 'Partido', 'Entrenamiento', 'Sesión', 'Aceleraciones',
  'Esfuerzo', 'Percibido', 'Recuperación', 'Warning', 'Critical', 'Crítico', 'Alerta', 'Umbral',
]);

const round1 = (n) => Math.round(n * 10) / 10;

function collectNumbers(value, out) {
  if (typeof value === 'number' && Number.isFinite(value)) out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectNumbers(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectNumbers(v, out));
  return out;
}

/** Conjunto de valores permitidos y nombres conocidos, derivado del contexto enviado al modelo. */
export function createGrounding(context) {
  const numbers = new Set();
  const add = (n) => {
    numbers.add(round1(Math.abs(n)));
    if (!Number.isInteger(n)) numbers.add(Math.round(Math.abs(n))); // "116.5 m/min" citado como "117"
  };
  collectNumbers(context, []).forEach(add);
  NARRATIVE_INTEGERS.forEach(add);
  context.session.date.split('-').map(Number).forEach(add); // fecha: 2026, 9, 19

  const fullNames = new Set(context.players.map((p) => p.name).filter(Boolean));
  const nameTokens = new Set([...fullNames].flatMap((n) => n.split(/\s+/)));
  const allowedPhrases = [context.session.title];

  return {
    numbers,
    fullNames,
    nameTokens,
    allowedPhrases,
    playerIds: new Set(context.players.map((p) => p.player_id)),
    alertIds: new Set(context.computed_alerts.map((a) => a.player_id)),
  };
}

// Interpretaciones posibles de un número escrito: "10,488" / "10.488" (miles), "29,6" / "29.6" (decimal).
// Si todos los grupos tras un separador tienen 3 dígitos, se lee SOLO como separador de miles:
// los datos tienen como máximo 1 decimal, y leer "11,000" como 11.0 dejaría pasar números inventados.
export function numberCandidates(token) {
  const out = new Set();
  if (/^\d{1,3}([.,]\d{3})+$/.test(token)) return [Number(token.replace(/[.,]/g, ''))];
  const lastSep = Math.max(token.lastIndexOf('.'), token.lastIndexOf(','));
  if (lastSep === -1) out.add(Number(token));
  else out.add(Number(`${token.slice(0, lastSep).replace(/[.,]/g, '')}.${token.slice(lastSep + 1)}`));
  return [...out].filter(Number.isFinite);
}

const NUMBER_RE = /\d+(?:[.,]\d+)*/g;
const NAME_SEQUENCE_RE = /\p{Lu}[\p{Ll}'’-]+(?:\s+\p{Lu}[\p{Ll}'’-]+)+/gu;

/** Problemas de grounding en un texto libre: números o nombres que no están en los datos. */
export function checkText(text, grounding, field) {
  const issues = [];

  for (const token of new Set(text.match(NUMBER_RE) ?? [])) {
    if (!numberCandidates(token).some((n) => grounding.numbers.has(round1(n)))) {
      issues.push({ field, message: `the number "${token}" does not appear in the session data (do not calculate or invent numbers)` });
    }
  }

  for (const sequence of new Set(text.match(NAME_SEQUENCE_RE) ?? [])) {
    const tokens = sequence.split(/\s+/);
    while (tokens.length && STOPWORDS.has(tokens[0])) tokens.shift();
    if (tokens.length < 2 || tokens.some((t) => DOMAIN_WORDS.has(t))) continue;
    const name = tokens.join(' ');
    if (grounding.fullNames.has(name)) continue;
    if (grounding.allowedPhrases.some((p) => p.includes(name))) continue;
    // Contiene un nombre completo válido seguido/precedido de otra palabra con mayúscula: aceptable.
    if ([...grounding.fullNames].some((full) => name.includes(full))) continue;
    issues.push({ field, message: `"${name}" is not the full name of a player in this session` });
  }

  return issues;
}

// Algunos modelos envuelven el JSON en ```json ... ``` aunque se les pida lo contrario.
export function parseModelJson(text) {
  const cleaned = String(text ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

/**
 * Valida la respuesta cruda del modelo.
 * @returns {{ output: object|null, issues: {field: string, message: string}[] }}
 *   `output` es el JSON parseado (aunque tenga problemas: se aprovechan los campos válidos).
 */
export function validateModelOutput(text, context, grounding = createGrounding(context)) {
  let output;
  try {
    output = parseModelJson(text);
  } catch (err) {
    return { output: null, issues: [{ field: '$', message: `the response is not valid JSON (${err.message})` }] };
  }
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    return { output: null, issues: [{ field: '$', message: 'the response must be a JSON object' }] };
  }

  const issues = [];

  if (typeof output.summary !== 'string' || !output.summary.trim()) {
    issues.push({ field: 'summary', message: 'summary must be a non-empty string' });
  } else {
    issues.push(...checkText(output.summary, grounding, 'summary'));
  }

  const highlights = Array.isArray(output.highlights) ? output.highlights : [];
  if (!Array.isArray(output.highlights)) issues.push({ field: 'highlights', message: 'highlights must be an array' });
  const seen = new Set();
  highlights.forEach((h, i) => {
    const field = `highlights[${i}]`;
    const id = Number(h?.player_id);
    if (!grounding.playerIds.has(id)) issues.push({ field, message: `player_id "${h?.player_id}" is not a player of this session` });
    else if (seen.has(id)) issues.push({ field, message: `player_id "${id}" is highlighted more than once` });
    seen.add(id);
    if (typeof h?.reason !== 'string' || !h.reason.trim()) issues.push({ field, message: 'reason must be a non-empty string' });
    else issues.push(...checkText(h.reason, grounding, field));
  });
  const validHighlights = highlights.filter((h, i) => !issues.some((x) => x.field === `highlights[${i}]`)).length;
  if (validHighlights < Math.min(2, grounding.playerIds.size) || highlights.length > 3) {
    issues.push({ field: 'highlights', message: `highlights must contain 2 or 3 valid players (got ${validHighlights} valid)` });
  }

  const alerts = Array.isArray(output.alerts) ? output.alerts : [];
  if (!Array.isArray(output.alerts)) issues.push({ field: 'alerts', message: 'alerts must be an array' });
  const commented = new Set();
  alerts.forEach((a, i) => {
    const field = `alerts[${i}]`;
    const id = Number(a?.player_id);
    if (!grounding.alertIds.has(id)) {
      issues.push({ field, message: `player_id "${a?.player_id}" has no computed alert; do not add alerts` });
      return;
    }
    commented.add(id);
    if (typeof a?.comment !== 'string' || !a.comment.trim()) issues.push({ field, message: 'comment must be a non-empty string' });
    else issues.push(...checkText(a.comment, grounding, field));
  });
  for (const id of grounding.alertIds) {
    if (!commented.has(id)) issues.push({ field: 'alerts', message: `missing the comment for the alert of player_id "${id}"` });
  }

  return { output, issues };
}
