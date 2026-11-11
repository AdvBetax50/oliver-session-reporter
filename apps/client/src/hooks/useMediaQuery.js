import { useSyncExternalStore } from 'react';

/**
 * true mientras la media query se cumple (p. ej. '(max-width: 639px)').
 * Se usa solo donde el CSS no alcanza: Recharts necesita valores numéricos (ancho del eje, márgenes).
 */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
