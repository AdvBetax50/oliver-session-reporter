import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import MetricChart, { buildChartData, shortName } from './MetricChart.jsx';
import { metricsResponse } from '../test/fixtures.js';

const { metrics, alerts, thresholds } = metricsResponse;

describe('buildChartData', () => {
  test('ordena de mayor a menor y asigna el nivel de alerta de cada jugador', () => {
    const { data, missing } = buildChartData(metrics, alerts, 'total_distance_m');
    expect(data.map((d) => [d.name, d.value, d.level])).toEqual([
      ['Santiago Molina', 10488, 'warning'],
      ['Mateo Suárez', 6262, 'normal'],
      ['Franco Medina', 2128, 'normal'],
    ]);
    expect(missing).toBe(0);
  });

  test('excluye los valores no reportados y los cuenta en `missing` (nunca dibuja un 0)', () => {
    const { data, missing } = buildChartData(metrics, alerts, 'rpe');
    expect(data.map((d) => d.name)).toEqual(['Santiago Molina', 'Franco Medina']);
    expect(missing).toBe(1);
    expect(buildChartData(metrics, alerts, 'workload_au').data[0]).toMatchObject({ value: 810, level: 'critical' });
  });
});

test('shortName abrevia el nombre para pantallas angostas', () => {
  expect(shortName('Santiago Molina')).toBe('S. Molina');
  expect(shortName('Pelé')).toBe('Pelé');
});

describe('MetricChart', () => {
  test('muestra la métrica por defecto y permite elegir otra; avisa cuántos jugadores no se muestran', async () => {
    const user = userEvent.setup();
    render(<MetricChart metrics={metrics} alerts={alerts} thresholds={thresholds} />);
    const select = screen.getByRole('combobox', { name: /metric/i });
    expect(select).toHaveTextContent('Total distance (m)');
    expect(screen.queryByText(/not shown/)).not.toBeInTheDocument();

    await user.click(select);
    await user.click(await screen.findByRole('option', { name: /RPE/ }));
    expect(select).toHaveTextContent('RPE (1–10)');
    expect(screen.getByText('1 player not shown: value not reported.')).toBeInTheDocument();
  });

  test('estado vacío cuando nadie tiene dato para la métrica', () => {
    const noData = metrics.map((m) => ({ ...m, totalDistanceM: null }));
    render(<MetricChart metrics={noData} alerts={[]} thresholds={thresholds} />);
    expect(screen.getByText('No data for this metric')).toBeInTheDocument();
  });
});
