import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { useAsync } from './useAsync.js';

// Promesa controlable desde el test
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('useAsync', () => {
  test('loading -> success con los datos', async () => {
    const { result } = renderHook(() => useAsync(async () => 'datos', []));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data).toBe('datos');
    expect(result.current.error).toBeNull();
  });

  test('loading -> error con el error recibido', async () => {
    const { result } = renderHook(() => useAsync(async () => { throw new Error('falló'); }, []));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error.message).toBe('falló');
  });

  test('enabled=false no ejecuta nada (idle)', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useAsync(fn, [], { enabled: false }));
    expect(result.current.status).toBe('idle');
    expect(fn).not.toHaveBeenCalled();
  });

  test('al cambiar las dependencias cancela la petición anterior y nunca muestra una respuesta vieja', async () => {
    const calls = [];
    const { result, rerender } = renderHook(({ id }) => useAsync((signal) => {
      const d = deferred();
      calls.push({ id, signal, d });
      return d.promise;
    }, [id]), { initialProps: { id: 1 } });

    rerender({ id: 2 });
    expect(calls[0].signal.aborted).toBe(true);
    expect(calls[1].signal.aborted).toBe(false);

    await act(async () => calls[1].d.resolve('sesión 2'));
    await act(async () => calls[0].d.resolve('sesión 1 (tarde)')); // llega después: debe ignorarse
    expect(result.current.data).toBe('sesión 2');
  });

  test('mientras recarga conserva los datos anteriores (sin parpadeo)', async () => {
    let n = 0;
    const pending = deferred();
    const { result, rerender } = renderHook(({ key }) => useAsync(() => (++n === 1 ? Promise.resolve('v1') : pending.promise), [key]), {
      initialProps: { key: 'a' },
    });
    await waitFor(() => expect(result.current.data).toBe('v1'));
    rerender({ key: 'b' });
    expect(result.current.status).toBe('loading');
    expect(result.current.data).toBe('v1');
    await act(async () => pending.resolve('v2'));
    expect(result.current.data).toBe('v2');
  });

  test('reload vuelve a ejecutar la función', async () => {
    const fn = vi.fn(async () => 'ok');
    const { result } = renderHook(() => useAsync(fn, []));
    await waitFor(() => expect(result.current.status).toBe('success'));
    await act(async () => result.current.reload());
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
  });

  test('al desmontar cancela la petición en curso', () => {
    let signal;
    const { unmount } = renderHook(() => useAsync((s) => { signal = s; return new Promise(() => {}); }, []));
    unmount();
    expect(signal.aborted).toBe(true);
  });
});
