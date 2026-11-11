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
