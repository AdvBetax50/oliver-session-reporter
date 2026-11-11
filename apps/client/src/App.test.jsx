// Flujo completo de la app con la API simulada (fetch): carga de sesiones, selección por defecto,
// métricas, orden en el servidor, cambio de sesión y estados de error y vacío.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import App from './App.jsx';
import { jsonResponse, metricsResponse, sessions } from './test/fixtures.js';

function mockApi({ sessionsResponse = jsonResponse(sessions) } = {}) {
  const fetch = vi.fn(async (url) => {
    if (url === '/api/sessions') return typeof sessionsResponse === 'function' ? sessionsResponse() : sessionsResponse;
    const m = url.match(/^\/api\/sessions\/(\d+)\/metrics/);
    if (m) {
      const id = Number(m[1]);
      const s = sessions.find((x) => x.id === id);
      return jsonResponse({ ...metricsResponse, session: { ...metricsResponse.session, ...s } });
    }
    throw new Error(`URL inesperada: ${url}`);
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
const metricsCalls = (fetch) => fetch.mock.calls.map(([url]) => url).filter((u) => u.includes('/metrics'));

describe('App', () => {
  test('carga las sesiones, selecciona la más reciente y muestra sus métricas', async () => {
    const fetch = mockApi();
    render(<App />);
    expect(screen.getByText('Loading sessions…')).toBeInTheDocument();

    expect(await screen.findByRole('heading', { level: 2, name: 'Partido amistoso vs. Deportivo Ejemplo' })).toBeInTheDocument();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Santiago Molina')).toBeInTheDocument();
    expect(screen.getByText(/90 min · 3 players/)).toBeInTheDocument();
    expect(metricsCalls(fetch)[0]).toBe('/api/sessions/103/metrics?order_by=shirt_number&order=asc');
    expect(screen.getByText('No report generated yet')).toBeInTheDocument();
  });

  test('ordenar pide a la API el nuevo orden; el segundo clic invierte el sentido', async () => {
    const fetch = mockApi();
    const user = userEvent.setup();
    render(<App />);
    const table = await screen.findByRole('table');

    await user.click(within(table).getByRole('button', { name: /workload/i }));
    await waitFor(() => expect(metricsCalls(fetch).at(-1)).toBe('/api/sessions/103/metrics?order_by=workload_au&order=desc'));
    await waitFor(() => expect(within(table).getByRole('button', { name: /workload/i })).toBeEnabled());
    await user.click(within(table).getByRole('button', { name: /workload/i }));
    await waitFor(() => expect(metricsCalls(fetch).at(-1)).toBe('/api/sessions/103/metrics?order_by=workload_au&order=asc'));
  });

  test('cambiar de sesión carga sus métricas y reinicia el orden', async () => {
    const fetch = mockApi();
    const user = userEvent.setup();
    render(<App />);
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: /sprints/i }));

    await user.click(screen.getByRole('combobox', { name: /session/i }));
    await user.click(await screen.findByRole('option', { name: /Entrenamiento táctico/ }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Entrenamiento táctico' })).toBeInTheDocument();
    await waitFor(() => expect(metricsCalls(fetch).at(-1)).toBe('/api/sessions/101/metrics?order_by=shirt_number&order=asc'));
  });

  test('error al cargar sesiones -> mensaje y "Try again" vuelve a pedirlas', async () => {
    let fail = true;
    const fetch = mockApi({
      sessionsResponse: () => (fail ? jsonResponse({ error: 'db down' }, { status: 503 }) : jsonResponse(sessions)),
    });
    const user = userEvent.setup();
    render(<App />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Sessions could not be loaded');
    expect(alert).toHaveTextContent('The database is not available.');

    fail = false;
    await user.click(within(alert).getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(fetch.mock.calls.filter(([u]) => u === '/api/sessions')).toHaveLength(2);
  });

  test('sin sesiones -> estado vacío con instrucciones', async () => {
    mockApi({ sessionsResponse: jsonResponse([]) });
    render(<App />);
    expect(await screen.findByText('No sessions yet')).toBeInTheDocument();
    expect(screen.getByText(/npm run db:setup/)).toBeInTheDocument();
  });
});
