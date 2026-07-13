import { useEffect, useRef, useState } from "react";

const prefiereReducido = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Anima un número desde su valor mostrado actual hasta `valor` con requestAnimationFrame y easing cubic-out
 *
 * @param {number} valor                    Valor objetivo a mostrar
 * @param {object} [opciones]
 * @param {number} [opciones.duracion=700]  Duración de la animación en ms
 * @returns {number}                        El número a renderizar en cada frame
 */
export function useContador(valor, { duracion = 700 } = {}) {
  const objetivo = Number.isFinite(valor) ? valor : 0;
  const [mostrado, setMostrado] = useState(objetivo);
  const mostradoRef = useRef(objetivo);

  useEffect(() => {
    mostradoRef.current = mostrado;
  }, [mostrado]);

  useEffect(() => {
    if (duracion <= 0 || prefiereReducido()) {
      const raf = requestAnimationFrame(() => setMostrado(objetivo));
      return () => cancelAnimationFrame(raf);
    }
    const desde = mostradoRef.current;
    if (desde === objetivo) return undefined;

    let raf;
    const inicio = performance.now();
    const paso = (ahora) => {
      const t = Math.min(1, (ahora - inicio) / duracion);
      const e = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setMostrado(Math.round(desde + (objetivo - desde) * e));
      if (t < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [objetivo, duracion]);

  return mostrado;
}