import { useEffect, useState } from "react";

export function useCargaAsync(fn, deps = []) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vigente = true;
    fn()
      .then((resultado) => { if (vigente) setDatos(resultado); })
      .catch((e) => { if (vigente) setError(e); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { datos, cargando, error };
}
