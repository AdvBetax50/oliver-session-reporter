import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { jsonResponse, reportResponse } from '../test/fixtures.js';

// Los toasts se verifican como llamadas (el <Toaster> vive en App)
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', async (orig) => ({ ...(await orig()), toast }));

const { default: ReportPanel } = await import('./ReportPanel.jsx');

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

function setup() {
  const user = userEvent.setup();
  const utils = render(<TooltipProvider><ReportPanel sessionId={103} /></TooltipProvider>);
  return { user, ...utils };
}
const generateButton = () => screen.getByRole('button', { name: /generate report|regenerate report|generating/i });

beforeEach(() => {
  toast.success.mockClear();
  toast.error.mockClear();
});

describe('ReportPanel', () => {
  test('estado vacío inicial con instrucciones y valores por defecto English / Coach', () => {
    setup();
    expect(screen.getByText('No report generated yet')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Coach' })).toHaveAttribute('aria-checked', 'true');
  });

  test('carga -> reporte: envía idioma y audiencia elegidos y muestra todas las secciones', async () => {
    const pending = deferred();
    const fetch = vi.fn(() => pending.promise);
    vi.stubGlobal('fetch', fetch);
    const { user } = setup();

    await user.click(screen.getByRole('radio', { name: 'Español' }));
    await user.click(screen.getByRole('radio', { name: 'Players' }));
    await user.click(generateButton());

    // Estado de carga
    expect(screen.getByText(/The AI is analyzing the session/)).toBeInTheDocument();
    expect(generateButton()).toBeDisabled();
    expect(generateButton()).toHaveTextContent('Generating…');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ language: 'es', audience: 'player' });

    await act(async () => pending.resolve(jsonResponse(reportResponse({ language: 'es', audience: 'player' }))));

    const article = screen.getByRole('article');
    expect(within(article).getByText(/High-intensity match/)).toBeInTheDocument();
    // Destacados: el de respaldo lleva la etiqueta "Data-based"
    expect(within(article).getByText('Led the team with 10,488 m.')).toBeInTheDocument();
    expect(within(article).getAllByText('Data-based')).toHaveLength(1);
    // Alertas con nivel accesible, métricas y comentario
    expect(within(article).getByText('Critical')).toBeInTheDocument();
    expect(within(article).getByText('Prioritize recovery.')).toBeInTheDocument();
    expect(within(article).getByText('810 AU')).toBeInTheDocument();
    // Calidad de datos
    expect(within(article).getByText(/Mateo Suárez/)).toBeInTheDocument();
    expect(within(article).getByText(/Franco Medina \(28 min\)/)).toBeInTheDocument();
    // Aviso de respaldo (fallbackFields no vacío) y metadatos
    expect(within(article).getByText(/replaced by text generated from the verified data/)).toBeInTheDocument();
    expect(within(article).getByText(/session-report\.v1/)).toBeInTheDocument();
    expect(generateButton()).toHaveTextContent('Regenerate report');
    expect(toast.success).toHaveBeenCalledWith('Report generated', expect.any(Object));
  });

  test('sin alertas muestra el mensaje de éxito', async () => {
    const data = reportResponse();
    data.report.alerts = [];
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(data)));
    const { user } = setup();
    await user.click(generateButton());
    expect(await screen.findByText('No player reached the defined thresholds in this session.')).toBeInTheDocument();
  });

  test('error -> mensaje, detalle del servidor y "Try again" reintenta', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'Gemini no respondió en 30000 ms', code: 'timeout' }, { status: 504 }))
      .mockResolvedValueOnce(jsonResponse(reportResponse()));
    vi.stubGlobal('fetch', fetch);
    const { user } = setup();

    await user.click(generateButton());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The report could not be generated');
    expect(alert).toHaveTextContent('The AI provider took too long to respond.');
    expect(alert).toHaveTextContent('Server detail: Gemini no respondió en 30000 ms');
    expect(toast.error).toHaveBeenCalled();

    await user.click(within(alert).getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('article')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('si cambia idioma o audiencia después de generar, avisa que hay que regenerar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(reportResponse())));
    const { user } = setup();
    await user.click(generateButton());
    await screen.findByRole('article');
    expect(screen.queryByText(/Language or audience changed/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Español' }));
    expect(screen.getByText(/Language or audience changed/)).toBeInTheDocument();
  });

  test('al desmontar (cambio de sesión) cancela la petición y no pinta una respuesta tardía', async () => {
    const pending = deferred();
    let signal;
    vi.stubGlobal('fetch', vi.fn((url, init) => { signal = init.signal; return pending.promise; }));
    const { user, unmount } = setup();
    await user.click(generateButton());
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(jsonResponse(reportResponse())));
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe('ReportPanel — caché en localStorage', () => {
  // Reporte que pasó la validación (cacheable)
  const validated = (language = 'en', audience = 'coach', summary = `Saved ${language}/${audience}`) => {
    const data = reportResponse({ language, audience });
    data.report = { ...data.report, summary };
    data.meta = { ...data.meta, validation: { passed: true, issues: [], fallbackFields: [] } };
    return data;
  };
  const key = (language, audience) => `oliver:report:v1:103:${language}:${audience}`;
  const savedButton = () => screen.getByRole('button', { name: /report saved/i });

  test('un reporte validado se guarda; luego el botón queda en "Report saved" y no vuelve a llamar a la IA', async () => {
    const fetch = vi.fn(async () => jsonResponse(validated()));
    vi.stubGlobal('fetch', fetch);
    const { user } = setup();

    await user.click(generateButton());
    expect(await screen.findByText('Saved en/coach')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(key('en', 'coach'))).report.summary).toBe('Saved en/coach');
    expect(toast.success).toHaveBeenCalledWith('Report generated', expect.objectContaining({ description: expect.stringMatching(/Saved in this browser/) }));

    expect(savedButton()).toBeDisabled();
    await user.click(savedButton());
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('al volver a abrir la sesión, el reporte guardado se muestra al instante sin llamar a la API', async () => {
    window.localStorage.setItem(key('en', 'coach'), JSON.stringify(validated()));
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    setup();

    expect(screen.getByText('Saved en/coach')).toBeInTheDocument();
    expect(screen.getByText(/Saved report, generated on/)).toBeInTheDocument();
    expect(screen.queryByText('No report generated yet')).not.toBeInTheDocument();
    expect(savedButton()).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('cada idioma y audiencia se genera una vez y se guarda por separado; cambiar entre ellas usa el caché', async () => {
    const fetch = vi.fn(async (url, init) => {
      const { language, audience } = JSON.parse(init.body);
      return jsonResponse(validated(language, audience));
    });
    vi.stubGlobal('fetch', fetch);
    const { user } = setup();

    await user.click(generateButton()); // en/coach
    await screen.findByText('Saved en/coach');

    await user.click(screen.getByRole('radio', { name: 'Español' })); // es/coach: aún no existe
    expect(screen.getByText(/Language or audience changed/)).toBeInTheDocument();
    await user.click(generateButton());
    await screen.findByText('Saved es/coach');

    await user.click(screen.getByRole('radio', { name: 'Players' })); // es/player
    await user.click(generateButton());
    await screen.findByText('Saved es/player');
    expect(fetch).toHaveBeenCalledTimes(3);

    // Volver a combinaciones ya generadas: se muestran desde el caché, sin nuevas llamadas
    await user.click(screen.getByRole('radio', { name: 'English' }));
    await user.click(screen.getByRole('radio', { name: 'Coach' }));
    expect(screen.getByText('Saved en/coach')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Español' }));
    expect(screen.getByText('Saved es/coach')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(3);
    expect([key('en', 'coach'), key('es', 'coach'), key('es', 'player')].every((k) => window.localStorage.getItem(k))).toBe(true);
  });

  test('el reporte guardado no se sobreescribe aunque exista uno distinto en el servidor', async () => {
    window.localStorage.setItem(key('en', 'coach'), JSON.stringify(validated('en', 'coach', 'Original')));
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(validated('en', 'coach', 'Nuevo'))));
    const { user } = setup();
    await user.click(savedButton()); // deshabilitado: no hace nada
    expect(screen.getByText('Original')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(key('en', 'coach'))).report.summary).toBe('Original');
  });

  test('un reporte con partes de respaldo NO se guarda y se puede volver a pedir a la IA', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(reportResponse())) // validation.passed = false
      .mockResolvedValueOnce(jsonResponse(validated()));
    vi.stubGlobal('fetch', fetch);
    const { user } = setup();

    await user.click(generateButton());
    await screen.findByRole('article');
    expect(window.localStorage.getItem(key('en', 'coach'))).toBeNull();
    expect(toast.success).toHaveBeenLastCalledWith('Report generated', expect.objectContaining({ description: expect.stringMatching(/not saved/) }));
    expect(generateButton()).toHaveTextContent('Regenerate report');

    await user.click(generateButton());
    await screen.findByText('Saved en/coach');
    expect(window.localStorage.getItem(key('en', 'coach'))).not.toBeNull();
    expect(savedButton()).toBeDisabled();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('los errores no se guardan en el caché', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'quota' }, { status: 429 })));
    const { user } = setup();
    await user.click(generateButton());
    await screen.findByRole('alert');
    expect(window.localStorage.length).toBe(0);
  });

  test('si localStorage falla (modo privado / lleno), el reporte se muestra igual', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError'); });
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(validated())));
    const { user } = setup();
    await user.click(generateButton());
    expect(await screen.findByText('Saved en/coach')).toBeInTheDocument();
    expect(generateButton()).toHaveTextContent('Regenerate report');
  });
});
