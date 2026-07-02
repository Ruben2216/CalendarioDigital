import { useEffect, useRef } from "react";

export function useClicFuera(refs, activo, alCerrar) {
  const alCerrarRef = useRef(alCerrar);
  useEffect(() => {
    alCerrarRef.current = alCerrar;
  });

  useEffect(() => {
    if (!activo) return undefined;
    const lista = Array.isArray(refs) ? refs : [refs];
    const fuera = (e) => {
      if (lista.some((r) => r.current && r.current.contains(e.target))) return;
      alCerrarRef.current();
    };
    document.addEventListener("mousedown", fuera, true);
    return () => document.removeEventListener("mousedown", fuera, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo]);
}
