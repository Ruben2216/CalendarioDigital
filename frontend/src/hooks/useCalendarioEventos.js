import { useCallback, useEffect, useMemo, useState } from "react";
import { listarCalendarios, listarTipos, listarEventos } from "../services/eventosService.js";

export function useCalendarioEventos() {
  const [calendarios, setCalendarios] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [calendarioActivo, setCalendarioActivo] = useState(null);

  const tiposPorId = useMemo(() => {
    const mapa = new Map();
    for (const t of tipos) mapa.set(t.id, t);
    return mapa;
  }, [tipos]);
  const colorTipo = useCallback((id) => tiposPorId.get(id)?.color ?? "gris", [tiposPorId]);
  const etiquetaTipo = useCallback((id) => tiposPorId.get(id)?.etiqueta ?? "Evento", [tiposPorId]);

  const recargar = useCallback(async (idCal) => {
    if (!idCal) return;
    try {
      setEventos(await listarEventos(idCal));
    } catch {
      setEventos([]);
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [cals, tps] = await Promise.all([listarCalendarios(), listarTipos()]);
        if (!vivo) return;
        setCalendarios(cals);
        setTipos(tps);
        setCalendarioActivo((prev) => prev ?? (cals[0]?.id ?? null));
      } catch {
      }
    })();
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    if (calendarioActivo) recargar(calendarioActivo);
  }, [calendarioActivo, recargar]);

  return {
    calendarios, tipos, eventos,
    calendarioActivo, setCalendarioActivo,
    colorTipo, etiquetaTipo, recargar,
  };
}
