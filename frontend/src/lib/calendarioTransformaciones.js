import { aClaveFecha, desdeClaveFecha, sumarDias } from "./fechas.js";

export const COLOR_GRIS = "#97a3b6";

export function mapaTipos(tipos) {
  const mapa = new Map();
  for (const t of tipos) mapa.set(t.id, t);
  return mapa;
}

export function colorDeTipo(tiposPorId, id) {
  return tiposPorId.get(id)?.color ?? COLOR_GRIS;
}

export function etiquetaDeTipo(tiposPorId, id) {
  return tiposPorId.get(id)?.etiqueta ?? "Sin tipo";
}

export function filtrarEventos(eventos, filtros) {
  const {
    filtroTipo, filtroArea, filtroSemestre, filtroGrupo,
    filtroPlantel, filtroTurno, filtroFechaDesde, filtroFechaHasta,
  } = filtros;
  return eventos.filter((ev) => {
    if (filtroTipo !== "todos" && ev.tipo !== filtroTipo) return false;
    if (filtroArea !== "todas" && ev.area !== filtroArea) return false;
    if (filtroSemestre && ev.semestre != null && String(ev.semestre) !== filtroSemestre) return false;
    if (filtroGrupo && ev.grupo != null && ev.grupo !== filtroGrupo) return false;
    if (filtroPlantel && ev.plantel != null && ev.plantel !== filtroPlantel) return false;
    if (filtroTurno && ev.turno != null && ev.turno !== filtroTurno) return false;
    if (filtroFechaDesde && (ev.fechaFin || ev.fecha) < filtroFechaDesde) return false;
    if (filtroFechaHasta && ev.fecha > filtroFechaHasta) return false;
    return true;
  });
}

export function eventosParaFullCalendar(eventos, colorTipo, vista) {
  const result = [];
  for (const ev of eventos) {
    const color = colorTipo(ev.tipo);
    const base = {
      id: String(ev.id),
      title: ev.titulo,
      backgroundColor: color,
      borderColor: color,
      extendedProps: { original: ev },
    };

    if (ev.horaInicio) {
      const fechaFinal = ev.fechaFin || ev.fecha;
      if (vista === "semana" && fechaFinal !== ev.fecha) {
        const inicio = desdeClaveFecha(ev.fecha);
        const fin = desdeClaveFecha(fechaFinal);
        const cursor = new Date(inicio);
        while (cursor <= fin) {
          const clave = aClaveFecha(cursor);
          result.push({
            ...base,
            id: `${ev.id}_${clave}`,
            start: `${clave}T${ev.horaInicio}`,
            end: ev.horaFin ? `${clave}T${ev.horaFin}` : undefined,
          });
          cursor.setDate(cursor.getDate() + 1);
        }
      } else {
        result.push({
          ...base,
          start: `${ev.fecha}T${ev.horaInicio}`,
          end: ev.horaFin ? `${fechaFinal}T${ev.horaFin}` : undefined,
        });
      }
    } else {
      const finBase = ev.fechaFin || ev.fecha;
      result.push({
        ...base,
        allDay: true,
        start: ev.fecha,
        end: aClaveFecha(sumarDias(desdeClaveFecha(finBase), 1)),
      });
    }
  }
  return result;
}

export function agruparEventosPorDia(eventos) {
  const mapa = new Map();
  for (const ev of eventos) {
    const inicio = desdeClaveFecha(ev.fecha);
    const fin = ev.fechaFin ? desdeClaveFecha(ev.fechaFin) : inicio;
    const cursor = new Date(inicio);
    while (cursor <= fin) {
      const clave = aClaveFecha(cursor);
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave).push(ev);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  for (const lista of mapa.values()) {
    lista.sort((a, b) => (a.horaInicio || "").localeCompare(b.horaInicio || ""));
  }
  return mapa;
}
