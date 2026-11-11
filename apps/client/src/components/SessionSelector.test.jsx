import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import SessionSelector from './SessionSelector.jsx';
import { sessions } from '../test/fixtures.js';

test('muestra la sesión seleccionada con fecha, título y tipo, y avisa el id numérico al cambiar', async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<SessionSelector sessions={sessions} value={103} onChange={onChange} />);

  const trigger = screen.getByRole('combobox', { name: /session/i });
  expect(trigger).toHaveTextContent('Sep 19, 2026');
  expect(trigger).toHaveTextContent('Partido amistoso vs. Deportivo Ejemplo');
  expect(trigger).toHaveTextContent('Match');

  await user.click(trigger);
  const options = await screen.findAllByRole('option');
  expect(options).toHaveLength(3);
  await user.click(screen.getByRole('option', { name: /Entrenamiento táctico/ }));
  expect(onChange).toHaveBeenCalledWith(101);
});

test('sin sesión seleccionada muestra el placeholder (y no avisa nada)', () => {
  const onChange = vi.fn();
  render(<SessionSelector sessions={sessions} value={null} onChange={onChange} />);
  expect(screen.getByRole('combobox', { name: /session/i })).toHaveTextContent('Select a session');
  expect(onChange).not.toHaveBeenCalled();
});
