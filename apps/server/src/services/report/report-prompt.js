// Construye los mensajes del reporte a partir del prompt versionado (prompts/session-report.<version>.md).
import { loadPrompt, renderTemplate, requireSection } from '../../prompts/prompt-loader.js';

export function buildReportPrompt(context, { language, audience, version = process.env.REPORT_PROMPT_VERSION || 'v1' }) {
  const prompt = loadPrompt('session-report', version);
  const vars = {
    session_kind: context.session.type === 'match' ? 'match' : 'training session',
    language_name: requireSection(prompt, `LANGUAGE ${language}`),
    audience_guide: requireSection(prompt, `AUDIENCE ${audience}`),
    context_json: JSON.stringify(context),
  };

  const system = renderTemplate(requireSection(prompt, 'SYSTEM'), vars);
  const user = renderTemplate(requireSection(prompt, 'USER'), vars);

  return {
    version: prompt.id,
    system,
    user,
    // Mensaje de corrección para el segundo intento, con los problemas detectados por el validador.
    retry(previousAnswer, issues) {
      const retryText = renderTemplate(requireSection(prompt, 'RETRY'), {
        issues: issues.map((i) => `- ${i.field}: ${i.message}`).join('\n'),
        previous_answer: previousAnswer.slice(0, 6000),
      });
      return `${user}\n\n${retryText}`;
    },
  };
}
