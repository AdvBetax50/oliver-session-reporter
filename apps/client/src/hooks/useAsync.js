import { useCallback, useEffect, useState } from 'react';

/**
 * Ejecuta una función async cuando cambian `deps` y expone su estado.
 * - Cancela la petición anterior (AbortController) para evitar condiciones de carrera:
 *   si el usuario cambia de sesión rápido, nunca se pinta una respuesta vieja.
 * - Conserva `data` mientras recarga, para no hacer parpadear la tabla al reordenar.
 *
 * @returns {{ status: 'idle'|'loading'|'success'|'error', data: any, error: Error|null, reload: () => void }}
 */
export function useAsync(asyncFn, deps, { enabled = true } = {}) {
  const [state, setState] = useState({ status: enabled ? 'loading' : 'idle', data: null, error: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    setState((s) => ({ ...s, status: 'loading', error: null }));
    asyncFn(controller.signal)
      .then((data) => setState({ status: 'success', data, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState((s) => ({ ...s, status: 'error', error }));
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
