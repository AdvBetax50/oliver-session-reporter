// Tests unitarios del reporte: contexto, validador (grounding), respaldo y prompt versionado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInMemoryRepos } from './helpers/in-memory-repos.js';
import { createSessionService } from '../src/services/session.service.js';
import { evaluateAlerts } from '../src/services/alerts.js';
import { buildReportContext } from '../src/services/report/report-context.js';
import { buildReportPrompt } from '../src/services/report/report-prompt.js';
import { buildReportSchema } from '../src/services/report/report-schema.js';
import { checkText, createGrounding, numberCandidates, validateModelOutput } from '../src/services/report/report-validator.js';
import { fallbackAlertComment, fallbackHighlightCandidates, fallbackHighlightReason, fallbackSummary } from '../src/services/report/report-fallback.js';
import { loadPrompt, parsePromptFile, renderTemplate } from '../src/prompts/prompt-loader.js';

const sessions = createSessionService(createInMemoryRepos());
async function contextFor(sessionId) {
  const data = await sessions.getSessionContext(sessionId);
  return buildReportContext(data, evaluateAlerts(data.metrics, data.thresholds));
}

test('contexto: marca pocos minutos y RPE ausente, y no alerta sobre valores null', async () => {
  const ctx = await contextFor(103);
  const medina = ctx.players.find((p) => p.player_id === 11);
  const castro = ctx.players.find((p) => p.player_id === 8);
  const suarez = ctx.players.find((p) => p.player_id === 9);
  assert.equal(medina.low_minutes, true); // 28 de 90 min
  assert.equal(castro.low_minutes, false); // 62 de 90 min
  assert.equal(suarez.rpe, null);
  assert.equal(suarez.workload_au, null);
  assert.equal(suarez.rpe_reported, false);
  assert.ok(!ctx.computed_alerts.some((a) => a.player_id === 9));
  assert.deepEqual(ctx.data_quality.players_without_rpe, [{ player_id: 9, name: 'Mateo Suárez' }]);
  assert.equal(ctx.team_summary.rpe_reported_by, 11);
  assert.equal(ctx.team_summary.averages_exclude_low_minutes_players, true);
  assert.equal(ctx.rankings.total_distance_m[0].name, 'Santiago Molina');
});

test('números: acepta formatos es/en y redondeo, rechaza inventados', async () => {
  const g = createGrounding(await contextFor(103));
  assert.deepEqual(numberCandidates('10,488'), [10488]);
  assert.deepEqual(numberCandidates('11,000'), [11000]); // nunca 11.0
  assert.deepEqual(numberCandidates('29,6'), [29.6]);
  for (const ok of ['10,488 m', '10.488 m', '116.5 m/min', '116,5 m/min', '117 m/min', '29 sprints', 'RPE 9', '19/09/2026', '+8%']) {
    assert.deepEqual(checkText(ok, g, 'f'), [], ok);
  }
  for (const bad of ['11,000 m', 'superó por 61 AU', '35 sprints', '12.5 km']) {
    assert.equal(checkText(bad, g, 'f').length, 1, bad);
  }
});

test('nombres: detecta jugadores inventados y combinaciones incorrectas', async () => {
  const g = createGrounding(await contextFor(103));
  assert.deepEqual(checkText('Santiago Molina y Bruno Acosta destacaron.', g, 'f'), []);
  assert.deepEqual(checkText('Hoy Santiago Molina rindió; Molina lideró. El partido vs. Deportivo Ejemplo.', g, 'f'), []);
  assert.deepEqual(checkText('Gran trabajo en High-Speed Running.', g, 'f'), []);
  assert.match(checkText('Lionel Messi fue el mejor.', g, 'f')[0].message, /Lionel Messi/);
  assert.match(checkText('Santiago Romero corrió mucho.', g, 'f')[0].message, /Santiago Romero/);
});

test('validador: estructura, ids inexistentes, alertas faltantes o inventadas', async () => {
  const ctx = await contextFor(103);
  const { issues } = validateModelOutput(JSON.stringify({
    summary: 'ok',
    highlights: [{ player_id: '999', reason: 'x' }],
    alerts: [{ player_id: '7', comment: 'x' }],
  }), ctx);
  const msgs = issues.map((i) => `${i.field}: ${i.message}`).join('\n');
  assert.match(msgs, /highlights\[0\]: player_id "999" is not a player/);
  assert.match(msgs, /highlights: highlights must contain 2 or 3/);
  assert.match(msgs, /alerts\[0\]: player_id "7" has no computed alert/);
  assert.match(msgs, /missing the comment for the alert of player_id "5"/);
  assert.equal(validateModelOutput('no json', ctx).output, null);
});

test('los textos de respaldo pasan el mismo validador (todas las sesiones e idiomas)', async () => {
  for (const id of [101, 102, 103]) {
    const ctx = await contextFor(id);
    const g = createGrounding(ctx);
    for (const lang of ['es', 'en']) {
      assert.deepEqual(checkText(fallbackSummary(ctx, lang), g, 'summary'), [], `${id}/${lang} summary`);
      for (const p of fallbackHighlightCandidates(ctx, new Set()).slice(0, 3)) {
        assert.deepEqual(checkText(fallbackHighlightReason(p, lang), g, 'h'), [], `${id}/${lang} highlight ${p.player_id}`);
      }
      for (const a of ctx.computed_alerts) {
        assert.deepEqual(checkText(fallbackAlertComment(a, lang), g, 'a'), [], `${id}/${lang} alert ${a.player_id}`);
      }
    }
    assert.ok(!fallbackHighlightCandidates(ctx, new Set()).some((p) => p.low_minutes), 'no se destaca por totales a quien jugó pocos minutos');
  }
});

test('schema: restringe player_id a los jugadores reales y a los que tienen alerta', async () => {
  const schema = buildReportSchema(await contextFor(101)); // sesión sin alertas
  assert.equal(schema.properties.highlights.items.properties.player_id.enum.length, 12);
  assert.equal(schema.properties.alerts.maxItems, 0);
});

test('prompt versionado: archivo legible con todas las secciones y sin placeholders sin resolver', async () => {
  const source = readFileSync(new URL('../prompts/session-report.v1.md', import.meta.url), 'utf8');
  const { meta, sections } = parsePromptFile(source);
  assert.equal(meta.version, 'v1');
  for (const s of ['SYSTEM', 'USER', 'RETRY', 'LANGUAGE es', 'LANGUAGE en', 'AUDIENCE coach', 'AUDIENCE player']) assert.ok(sections[s], s);

  const ctx = await contextFor(103);
  const p = buildReportPrompt(ctx, { language: 'es', audience: 'player' });
  assert.equal(p.version, 'session-report.v1');
  assert.doesNotMatch(p.system + p.user, /\{\{\w+\}\}/);
  assert.match(p.system, /Spanish/);
  assert.match(p.retry('{}', [{ field: 'summary', message: 'bad number' }]), /- summary: bad number/);
  assert.throws(() => renderTemplate('{{missing}}', {}), /missing/);
  // Los datos no se reinterpretan como placeholders (render en una sola pasada)
  assert.equal(renderTemplate('{{a}}', { a: '{{b}}' }), '{{b}}');
});

test('contexto: promedios sin los jugadores de pocos minutos, rankings y excesos precalculados', async () => {
  const ctx = await contextFor(103);
  const regulars = ctx.players.filter((p) => !p.low_minutes);
  const expectedAvg = Math.round(regulars.reduce((a, p) => a + p.total_distance_m, 0) / regulars.length);
  assert.equal(ctx.team_summary.avg_distance_m, expectedAvg);
  assert.equal(ctx.team_summary.avg_distance_m, 6868);
  assert.equal(ctx.team_summary.players_with_alerts, 5);
  assert.equal(ctx.team_summary.players_with_critical_alerts, 2);

  // Rankings: top 3 de mayor a menor, sin valores nulos
  assert.deepEqual(ctx.rankings.sprints.map((r) => [r.rank, r.player_id, r.value]), [[1, 10, 29], [2, 1, 24], [3, 6, 22]]);
  for (const list of Object.values(ctx.rankings)) {
    assert.ok(list.length <= 3 && list.every((r, i) => i === 0 || list[i - 1].value >= r.value));
  }

  // Distancia por minuto y % frente al promedio (enteros/1 decimal: el validador los puede citar)
  const molina = ctx.players.find((p) => p.player_id === 5);
  assert.equal(molina.distance_per_min, 116.5);
  assert.equal(molina.distance_vs_team_avg_pct, 53);

  // Exceso sobre el umbral alcanzado (critical si lo hay)
  const acosta = ctx.computed_alerts.find((a) => a.player_id === 10);
  assert.deepEqual(acosta.breaches.find((b) => b.metric === 'sprints'), {
    metric: 'sprints', value: 29, level: 'warning', threshold_reached: 28, warning: 28, critical: null, excess: 1, excess_pct: 4,
  });
});

test('prompt: una versión inexistente falla con un mensaje claro', () => {
  assert.throws(() => loadPrompt('session-report', 'v999'), /prompts\/session-report\.v999\.md.*REPORT_PROMPT_VERSION/);
  assert.equal(loadPrompt('session-report', 'v1').id, 'session-report.v1');
});
