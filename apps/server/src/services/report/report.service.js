import { generateWithRetry } from '../../ai/index.js';
import { evaluateAlerts } from '../alerts.js';
import { buildReportContext } from './report-context.js';
import { fallbackAlertComment, fallbackHighlightCandidates, fallbackHighlightReason, fallbackSummary } from './report-fallback.js';
import { buildReportPrompt } from './report-prompt.js';
import { buildReportSchema } from './report-schema.js';
import { createGrounding, validateModelOutput } from './report-validator.js';

// Intentos de generación por reporte: el original + 1 reintento con la lista de problemas.
const MAX_GENERATION_ATTEMPTS = 2;

/**
 * Arma el reporte final campo por campo. El modelo redacta; el código decide qué es verdad:
 * un campo con problemas de validación se reemplaza por su texto de respaldo (source: 'fallback').
 */
export function assembleReport(output, issues, context, language) {
  const bad = (field) => issues.some((i) => i.field === field || i.field === '$');
  const playersById = new Map(context.players.map((p) => [p.player_id, p]));
  const fallbackFields = [];

  // Resumen
  let summary;
  let summarySource = 'ai';
  if (typeof output?.summary === 'string' && output.summary.trim() && !bad('summary')) {
    summary = output.summary.trim();
  } else {
    summary = fallbackSummary(context, language);
    summarySource = 'fallback';
    fallbackFields.push('summary');
  }

  // Destacados: se conservan los válidos (máx. 3) y se completan hasta 2 con datos.
  const highlights = [];
  (Array.isArray(output?.highlights) ? output.highlights : []).forEach((h, i) => {
    const player = playersById.get(Number(h?.player_id));
    if (!player || bad(`highlights[${i}]`) || highlights.length === 3) return;
    if (highlights.some((x) => x.playerId === player.player_id)) return;
    highlights.push({ playerId: player.player_id, name: player.name, reason: h.reason.trim(), source: 'ai' });
  });
  if (highlights.length < 2) {
    const used = new Set(highlights.map((h) => h.playerId));
    for (const p of fallbackHighlightCandidates(context, used).slice(0, 2 - highlights.length)) {
      highlights.push({ playerId: p.player_id, name: p.name, reason: fallbackHighlightReason(p, language), source: 'fallback' });
      fallbackFields.push(`highlights:${p.player_id}`);
    }
  }

  // Alertas: siempre las calculadas por el código; el modelo solo aporta el comentario.
  const comments = new Map();
  (Array.isArray(output?.alerts) ? output.alerts : []).forEach((a, i) => {
    if (!bad(`alerts[${i}]`) && typeof a?.comment === 'string' && a.comment.trim()) comments.set(Number(a.player_id), a.comment.trim());
  });
  const alerts = context.computed_alerts.map((a) => {
    const aiComment = comments.get(a.player_id);
    if (!aiComment) fallbackFields.push(`alerts:${a.player_id}`);
    return {
      playerId: a.player_id,
      name: a.name,
      level: a.level,
      breaches: a.breaches.map((b) => ({
        metric: b.metric,
        value: b.value,
        level: b.level,
        warning: b.warning,
        critical: b.critical,
        threshold: b.threshold_reached,
        excess: b.excess,
      })),
      comment: aiComment ?? fallbackAlertComment(a, language),
      commentSource: aiComment ? 'ai' : 'fallback',
    };
  });

  return { report: { summary, summarySource, highlights, alerts }, fallbackFields };
}

/**
 * @param {{ sessionService: object, getAi: () => import('../../ai/index.js').AiProvider,
 *           retry?: { maxRetries?: number, maxWaitMs?: number, sleep?: (ms: number) => Promise<void> } }} deps
 */
export function createReportService({ sessionService, getAi, retry = {} }) {
  return {
    // POST /sessions/:id/report
    async generateReport({ sessionId, language, audience }) {
      // 1. Datos + cálculos deterministas (alertas, agregados, casos borde)
      const data = await sessionService.getSessionContext(sessionId);
      const context = buildReportContext(data, evaluateAlerts(data.metrics, data.thresholds));
      const grounding = createGrounding(context);
      const schema = buildReportSchema(context);
      const prompt = buildReportPrompt(context, { language, audience });

      // 2. Generación + validación, con un reintento que le explica al modelo qué falló
      const ai = getAi();
      const attempts = [];
      let request = { system: prompt.system, prompt: prompt.user, json: true, schema };
      for (let i = 0; i < MAX_GENERATION_ATTEMPTS; i++) {
        // Errores del proveedor (timeout, rate limit, red) se propagan tras sus propios reintentos.
        const response = await generateWithRetry(ai, request, retry);
        const { output, issues } = validateModelOutput(response.text, context, grounding);
        attempts.push({ response, output, issues });
        if (issues.length === 0) break;
        request = { ...request, prompt: prompt.retry(response.text, issues) };
      }

      // 3. Se usa el intento con menos problemas; sus campos inválidos se reemplazan por respaldo
      const best = attempts
        .filter((a) => a.output)
        .sort((a, b) => a.issues.length - b.issues.length)[0] ?? attempts.at(-1);
      const { report, fallbackFields } = assembleReport(best.output, best.issues, context, language);

      const { id, date, title, type } = data.session;
      const last = attempts.at(-1).response;
      return {
        session: { id, date, title, type },
        language,
        audience,
        report,
        dataQuality: {
          playersWithoutRpe: context.data_quality.players_without_rpe.map((p) => ({ playerId: p.player_id, name: p.name })),
          lowMinutesPlayers: context.data_quality.low_minutes_players.map((p) => ({
            playerId: p.player_id, name: p.name, minutesPlayed: p.minutes_played,
          })),
        },
        meta: {
          provider: last.provider,
          model: last.model,
          promptVersion: prompt.version,
          attempts: attempts.length,
          usage: {
            inputTokens: attempts.reduce((s, a) => s + (a.response.usage?.inputTokens ?? 0), 0),
            outputTokens: attempts.reduce((s, a) => s + (a.response.usage?.outputTokens ?? 0), 0),
          },
          validation: {
            passed: best.issues.length === 0,
            issues: attempts.map((a, i) => ({ attempt: i + 1, issues: a.issues })),
            fallbackFields,
          },
          generatedAt: new Date().toISOString(),
        },
      };
    },
  };
}
