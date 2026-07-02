import { useCallback, useEffect, useState } from "react";
import { listarCalendarios, listarTipos, listarEventos } from "../../../../services/eventosService.js";
import { avisoError } from "../../../../lib/alertas.js";

/* Carga el catálogo de calendarios y tipos al montar, y los eventos del
   calendario activo (recargables tras cada operación CRUD). */
export function useDatosCalendario({ publico, vistaPlantel }) {
  const [tipos, setTipos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [calendarios, setCalendarios] = useState([]);
  const [calendarioActivo, setCalendarioActivo] = useState(null);

  const cargarEventos = useCallback(async (idCal) => {
    if (!idCal) return;
    try {
      setEventos(await listarEventos(idCal, { publico, plantelFiltro: vistaPlantel }));
    } catch (e) {
      avisoError(e.message || "No se pudieron cargar los eventos.");
    }
  }, [publico, vistaPlantel]);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const [cals, tps] = await Promise.all([listarCalendarios(), listarTipos()]);
        if (!activo) return;
        setCalendarios(cals);
        setTipos(tps);
        setCalendarioActivo((prev) => prev ?? (cals[0]?.id ?? null));
      } catch (e) {
        if (activo) avisoError(e.message || "No se pudo cargar el calendario.");
      }
    })();
    return () => { activo = false; };
  }, []);

  useEffect(() => {
    if (calendarioActivo) cargarEventos(calendarioActivo);
  }, [calendarioActivo, cargarEventos]);

  return { tipos, setTipos, eventos, calendarios, calendarioActivo, setCalendarioActivo, cargarEventos };
}
