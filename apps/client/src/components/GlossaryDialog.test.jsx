import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import GlossaryDialog from './GlossaryDialog.jsx';
import { METRICS } from '../metrics.js';
import { thresholds } from '../test/fixtures.js';

test('abre la leyenda con todas las métricas, los umbrales de la sesión y los indicadores; se cierra', async () => {
  const user = userEvent.setup();
  render(<GlossaryDialog thresholds={thresholds} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /legend/i }));
  const dialog = await screen.findByRole('dialog', { name: /legend/i });

  // Las 8 métricas con la descripción de la referencia de campos del enunciado
  for (const m of METRICS) {
    expect(within(dialog).getByText(m.key)).toBeInTheDocument();
    expect(within(dialog).getByText(m.description)).toBeInTheDocument();
  }

  // Tabla de umbrales con los valores reales y "—" cuando no hay critical
  const rows = within(within(dialog).getByRole('table')).getAllByRole('row').slice(1);
  expect(rows).toHaveLength(4);
  const workload = rows.find((r) => r.textContent.startsWith('Workload'));
  expect(workload).toHaveTextContent('600 AU');
  expect(workload).toHaveTextContent('750 AU');
  expect(rows.find((r) => r.textContent.startsWith('Sprints'))).toHaveTextContent('—');

  // Indicadores
  for (const term of ['Warning', 'Critical', '— Not reported', 'Low minutes', 'Data-based']) {
    expect(within(dialog).getAllByText(term).length).toBeGreaterThan(0);
  }

  await user.click(within(dialog).getByRole('button', { name: 'Got it' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('sin umbrales (aún cargando) no muestra la tabla pero sí el resto de la leyenda', async () => {
  const user = userEvent.setup();
  render(<GlossaryDialog thresholds={undefined} />);
  await user.click(screen.getByRole('button', { name: /legend/i }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).queryByRole('table')).not.toBeInTheDocument();
  expect(within(dialog).getByText('Total distance covered, in meters.')).toBeInTheDocument();
});
