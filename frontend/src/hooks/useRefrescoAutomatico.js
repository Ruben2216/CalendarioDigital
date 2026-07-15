import { useEffect, useRef } from 'react';

const INTERVALO_MS = 5000;

/**
 * @param {() => (void | Promise<void>)} alRefrescar  Qué consultar y dónde guardarlo.
 * @param {number} intervaloMs                        Cada cuánto. Por defecto 5s.
 */
export function useRefrescoAutomatico(alRefrescar, intervaloMs = INTERVALO_MS) {
  const alRefrescarRef = useRef(alRefrescar);
  useEffect(() => {
    alRefrescarRef.current = alRefrescar;
  }, [alRefrescar]);

  useEffect(() => {
    const refrescar = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        await alRefrescarRef.current?.();
      } catch {
      }
    };

    const id = setInterval(refrescar, intervaloMs);
    document.addEventListener('visibilitychange', refrescar);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', refrescar);
    };
  }, [intervaloMs]);
}
