import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import MetricsTable from './MetricsTable.jsx';
import { metricsResponse } from '../test/fixtures.js';

// En jsdom no se aplica el CSS de Tailwind: la tabla (escritorio) y las tarjetas (móvil)
// están ambas en el DOM, así que cada vista se consulta por separado.
function setup(props = {}) {
  const onSort = vi.fn();
  render(
    <TooltipProvider>
      <MetricsTable
        metrics={metricsResponse.metrics}
        alerts={metricsResponse.alerts}
        thresholds={metricsResponse.thresholds}
        sort={{ orderBy: 'shirt_number', order: 'asc' }}
        onSort={onSort}
        loading={false}
        {...props}
      />
    </TooltipProvider>,
  );
  const table = screen.getByRole('table');
  const cards = screen.getAllByRole('list')[0];
  return { onSort, table, cards, user: userEvent.setup() };
}

describe('MetricsTable — tabla (escritorio)', () => {
  test('una fila por jugador con dorsal, nombre, posición y métricas formateadas', () => {
    const { table } = setup();
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText('Santiago Molina')).toBeInTheDocument();
    expect(within(rows[1]).getByText('MF')).toBeInTheDocument();
    expect(within(rows[1]).getByText('10,488')).toBeInTheDocument();
    expect(within(rows[1]).getByText('29.6')).toBeInTheDocument();
  });

  test('resalta los valores que alcanzan umbrales, con el nivel accesible (no solo color)', () => {
    const { table } = setup();
    const molina = within(table).getAllByRole('row')[2];
    expect(within(molina).getByText('810').closest('span')).toHaveTextContent('810 (critical)');
    expect(within(molina).getByText('10,488').closest('span')).toHaveTextContent('(warning)');
    expect(within(molina).getByText('810').closest('span').className).toMatch(/critical/);
  });

  test('valores no reportados se muestran como "—"', () => {
    const { table } = setup();
    const suarez = within(table).getAllByRole('row')[1];
    expect(within(suarez).getAllByText('—')).toHaveLength(2); // RPE y workload
  });

  test('clic en un encabezado avisa la columna (el orden lo resuelve el servidor)', async () => {
    const { table, onSort, user } = setup();
    await user.click(within(table).getByRole('button', { name: /workload/i }));
    expect(onSort).toHaveBeenCalledWith('workload_au');
    await user.click(within(table).getByRole('button', { name: /player/i }));
    expect(onSort).toHaveBeenLastCalledWith('name');
  });

  test('aria-sort refleja la columna y el sentido actuales', () => {
    const { table } = setup({ sort: { orderBy: 'workload_au', order: 'desc' } });
    const headers = within(table).getAllByRole('columnheader');
    const sorted = headers.filter((h) => h.getAttribute('aria-sort') !== 'none');
    expect(sorted).toHaveLength(1);
    expect(sorted[0]).toHaveTextContent(/workload/i);
    expect(sorted[0]).toHaveAttribute('aria-sort', 'descending');
  });

  test('mientras recarga, los encabezados se deshabilitan y la tabla queda aria-busy', () => {
    const { table } = setup({ loading: true });
    expect(table.closest('[aria-busy]')).toHaveAttribute('aria-busy', 'true');
    expect(within(table).getByRole('button', { name: /workload/i })).toBeDisabled();
  });
});

describe('MetricsTable — tarjetas (móvil y tablet)', () => {
  test('una tarjeta por jugador con todas las métricas y el conteo de alertas', () => {
    const { cards } = setup();
    const items = within(cards).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    const molina = items[1];
    expect(within(molina).getByText('Santiago Molina')).toBeInTheDocument();
    expect(within(molina).getByText('3 alerts')).toBeInTheDocument();
    expect(within(molina).getAllByRole('term')).toHaveLength(8);
    expect(within(items[0]).getAllByText('not reported')).toHaveLength(2);
  });

  test('el botón de sentido invierte el orden de la columna actual', async () => {
    const { onSort, user } = setup({ sort: { orderBy: 'workload_au', order: 'desc' } });
    await user.click(screen.getByRole('button', { name: /order: descending/i }));
    expect(onSort).toHaveBeenCalledWith('workload_au');
  });

  test('el selector "Sort by" cambia la columna de orden', async () => {
    const { onSort, user } = setup();
    await user.click(screen.getByRole('combobox', { name: /sort by/i }));
    await user.click(await screen.findByRole('option', { name: 'Sprints' }));
    expect(onSort).toHaveBeenCalledWith('sprints');
  });
});
