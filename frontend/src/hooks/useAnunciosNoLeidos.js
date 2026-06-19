import { useEffect, useState } from "react";
import { listarAnuncios } from "../services/anunciosService.js";
import { contarNoLeidos, EVENTO_LEIDOS } from "../lib/anunciosLeidos.js";

// Cantidad de anuncios no leídos del usuario actual (para el badge del menú de
// docente/alumno). Se recalcula cuando se marca alguno como leído.
export function useAnunciosNoLeidos() {
  const [noLeidos, setNoLeidos] = useState(0);

  useEffect(() => {
    let vigente = true;
    let cache = [];
    const recomputar = () => { if (vigente) setNoLeidos(contarNoLeidos(cache)); };
    listarAnuncios()
      .then((lista) => { cache = lista; recomputar(); })
      .catch(() => {});
    window.addEventListener(EVENTO_LEIDOS, recomputar);
    return () => { vigente = false; window.removeEventListener(EVENTO_LEIDOS, recomputar); };
  }, []);

  return noLeidos;
}
