// Carga prompts versionados desde apps/server/prompts/<name>.<version>.md
// Formato: front matter (---) + secciones "## NOMBRE" + placeholders {{variable}}.
import { readFileSync } from 'node:fs';

const PROMPTS_DIR = new URL('../../prompts/', import.meta.url);
const cache = new Map();

export function parsePromptFile(source) {
  const fm = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const meta = {};
  for (const line of fm?.[1].split(/\r?\n/) ?? []) {
    const [key, ...rest] = line.split(':');
    if (key.trim()) meta[key.trim()] = rest.join(':').trim();
  }

  const body = (fm ? source.slice(fm[0].length) : source).replace(/<!--[\s\S]*?-->/g, '');
  const sections = {};
  const parts = body.split(/^## (.+)$/m); // [antes, título1, contenido1, título2, contenido2, ...]
  for (let i = 1; i < parts.length; i += 2) sections[parts[i].trim()] = parts[i + 1].trim();
  return { meta, sections };
}

export function loadPrompt(name, version) {
  const key = `${name}.${version}`;
  if (!cache.has(key)) {
    let source;
    try {
      source = readFileSync(new URL(`${key}.md`, PROMPTS_DIR), 'utf8');
    } catch {
      throw new Error(`No existe el prompt prompts/${key}.md (revisa REPORT_PROMPT_VERSION)`);
    }
    const parsed = parsePromptFile(source);
    cache.set(key, { ...parsed, id: `${name}.${parsed.meta.version ?? version}` });
  }
  return cache.get(key);
}

// Reemplaza {{variable}} en una sola pasada: los valores insertados (p. ej. datos de jugadores)
// nunca se vuelven a interpretar como placeholders. Si falta una variable, falla en vez de
// enviar un prompt incompleto al modelo.
export function renderTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (vars[key] === undefined || vars[key] === null) throw new Error(`Falta la variable de prompt "${key}"`);
    return String(vars[key]);
  });
}

export function requireSection(prompt, section) {
  const text = prompt.sections[section];
  if (!text) throw new Error(`El prompt ${prompt.id} no tiene la sección "## ${section}"`);
  return text;
}
