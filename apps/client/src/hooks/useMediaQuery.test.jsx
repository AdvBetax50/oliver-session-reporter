import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { useMediaQuery } from './useMediaQuery.js';
import { cn } from '../lib/utils.js';

test('useMediaQuery refleja la media query y se actualiza cuando cambia', () => {
  const listeners = new Set();
  let matches = true;
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    media: query,
    get matches() { return matches; },
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
  }));

  const { result, unmount } = renderHook(() => useMediaQuery('(max-width: 639px)'));
  expect(result.current).toBe(true);
  expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 639px)');

  act(() => { matches = false; listeners.forEach((fn) => fn()); });
  expect(result.current).toBe(false);

  unmount();
  expect(listeners.size).toBe(0); // se desuscribe al desmontar
});

test('cn combina clases condicionales y resuelve conflictos de Tailwind (la última gana)', () => {
  expect(cn('px-2 py-1', false && 'hidden', 'px-4')).toBe('py-1 px-4');
  expect(cn('text-sm', { 'font-bold': true, italic: false })).toBe('text-sm font-bold');
});
