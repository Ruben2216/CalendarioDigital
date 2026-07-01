import {
  aClaveFecha, desdeClaveFecha, NOMBRES_MES, ABREV_MES, formatoHora,
} from "../../../../lib/fechas.js";
import { coloresDeDia } from "../../../../lib/colores.js";
import { alcanceEvento } from "../../../../data/calendario.js";

const COLOR_GRIS = "#97a3b6";

/* Eventos de ese día (expande los de varios días) */
function construirEventosPorDia(eventos) {
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

/* Celdas de un mes agrupadas en semanas de 7 */
function construirMes(anio, mes, eventosPorDia, colorPorTipo) {
  const primerDiaSemana = new Date(anio, mes, 1).getDay();
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const total = Math.ceil((primerDiaSemana + diasEnMes) / 7) * 7;
  const inicio = new Date(anio, mes, 1 - primerDiaSemana);

  const celdas = Array.from({ length: total }, (_, i) => {
    const fecha = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
    const enMes = fecha.getMonth() === mes;
    const clave = aClaveFecha(fecha);
    const evs = enMes ? eventosPorDia.get(clave) || [] : [];
    return {
      dia: fecha.getDate(),
      enMes,
      finde: fecha.getDay() === 0 || fecha.getDay() === 6,
      colores: coloresDeDia(evs, colorPorTipo),
    };
  });

  const semanas = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  return semanas;
}

const DIA_MS = 86400000;

function construirMesDetalle(anio, mes, eventos, colorPorTipo) {
  const primerDiaSemana = new Date(anio, mes, 1).getDay();
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const numSemanas = Math.ceil((primerDiaSemana + diasEnMes) / 7);
  const inicio = new Date(anio, mes, 1 - primerDiaSemana);

  const semanas = [];
  for (let w = 0; w < numSemanas; w++) {
    const ref = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + w * 7);
    const inicioSemana = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
    const finSemana = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + 6);

    const dias = Array.from({ length: 7 }, (_, d) => {
      const fecha = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + d);
      return {
        dia: fecha.getDate(),
        enMes: fecha.getMonth() === mes,
        finde: fecha.getDay() === 0 || fecha.getDay() === 6,
        colores: [],
      };
    });

    const segmentos = [];
    for (const ev of eventos) {
      const ini = desdeClaveFecha(ev.fecha);
      const fin = ev.fechaFin ? desdeClaveFecha(ev.fechaFin) : ini;
      if (fin < inicioSemana || ini > finSemana) continue;
      const startCol = ini <= inicioSemana ? 0 : Math.round((ini - inicioSemana) / DIA_MS);
      const endCol = fin >= finSemana ? 6 : Math.round((fin - inicioSemana) / DIA_MS);
      segmentos.push({
        id: ev.id,
        titulo: ev.titulo,
        color: colorPorTipo(ev.tipo),
        startCol,
        endCol,
        continuaIzq: ini < inicioSemana,
        continuaDer: fin > finSemana,
      });
    }
    segmentos.sort(
      (a, b) => a.startCol - b.startCol || b.endCol - b.startCol - (a.endCol - a.startCol)
    );

    const carriles = [];
    for (const seg of segmentos) {
      const libre = carriles.find((lane) =>
        lane.every((x) => seg.startCol > x.endCol || seg.endCol < x.startCol)
      );
      if (libre) libre.push(seg);
      else carriles.push([seg]);
    }

    for (let d = 0; d < 7; d++) {
      if (!dias[d].enMes) continue;
      const cubren = segmentos.filter((seg) => seg.startCol <= d && d <= seg.endCol);
      const coloresUnicos = [...new Set(cubren.map(seg => seg.color))];
      if (coloresUnicos.length) dias[d].colores = coloresUnicos;
    }
    semanas.push({ dias, carriles });
  }
  return semanas;
}

/* Detalle de un evento para la lista */
function detalleEvento(ev, colorPorTipo, etiquetaPorTipo) {
  const dia = Number(ev.fecha.slice(8, 10));
  const esMultiDia = ev.fechaFin && ev.fechaFin !== ev.fecha;
  const diaFin = esMultiDia ? Number(ev.fechaFin.slice(8, 10)) : dia;
  const mesIni = ABREV_MES[Number(ev.fecha.slice(5, 7)) - 1].toLowerCase();
  const mismoMes = !esMultiDia || ev.fecha.slice(0, 7) === ev.fechaFin.slice(0, 7);
  let periodo = null;
  if (esMultiDia) {
    const mesFin = ABREV_MES[Number(ev.fechaFin.slice(5, 7)) - 1].toLowerCase();
    periodo = mismoMes
      ? `Del ${dia} al ${diaFin} de ${mesIni}`
      : `Del ${dia} ${mesIni} al ${diaFin} ${mesFin}`;
  }
  return {
    id: ev.id,
    dia,
    rango: esMultiDia && mismoMes ? `${dia}–${diaFin}` : String(dia),
    periodo,
    titulo: ev.titulo,
    hora: ev.horaInicio ? formatoHora(ev.horaInicio) : "Todo el día",
    lugar: ev.lugar || "",
    plantel: ev.plantel || "Todos los planteles",
    turno: ev.turno || "",
    area: ev.area || "",
    alcance: alcanceEvento(ev),
    color: colorPorTipo(ev.tipo),
    tipo: etiquetaPorTipo(ev.tipo),
  };
}

/**
 * @param {object}   opts
 * @param {array}    opts.eventos      eventos a incluir
 * @param {array}    opts.tipos        catálogo de simbología [{ id, etiqueta, color }]
 * @param {number}   opts.anioCiclo    año en que arranca el ciclo (agosto)
 */
export function construirDatosAnual({ eventos, tipos, anioCiclo }) {
  const colorMap = new Map(tipos.map((t) => [t.id, t.color]));
  const etiquetaMap = new Map(tipos.map((t) => [t.id, t.etiqueta]));
  const colorPorTipo = (id) => colorMap.get(id) || COLOR_GRIS;
  const etiquetaPorTipo = (id) => etiquetaMap.get(id) || "Sin tipo";

  const eventosPorDia = construirEventosPorDia(eventos);

  const meses = Array.from({ length: 12 }, (_, k) => {
    const mes = (7 + k) % 12;
    const anio = mes >= 7 ? anioCiclo : anioCiclo + 1;
    return {
      mes,
      anio,
      nombre: NOMBRES_MES[mes],
      semestreA: k < 6,
      semanas: construirMes(anio, mes, eventosPorDia, colorPorTipo),
    };
  });

  const tiposUsados = new Set(eventos.map((ev) => ev.tipo));
  const simbologia = tipos
    .filter((t) => tiposUsados.has(t.id))
    .map((t) => ({ nombre: t.etiqueta, color: t.color }));

  // Lista: eventos agrupados por mes (solo meses con eventos)
  const listaPorMes = meses
    .map((m) => ({
      nombre: m.nombre,
      anio: m.anio,
      eventos: eventos
        .filter((ev) => {
          const f = desdeClaveFecha(ev.fecha);
          return f.getFullYear() === m.anio && f.getMonth() === m.mes;
        })
        .sort(
          (a, b) =>
            a.fecha.localeCompare(b.fecha) ||
            (a.horaInicio || "").localeCompare(b.horaInicio || "")
        )
        .map((ev) => detalleEvento(ev, colorPorTipo, etiquetaPorTipo)),
    }))
    .filter((m) => m.eventos.length > 0);

  return { meses, simbologia, listaPorMes, ciclo: `${anioCiclo} – ${anioCiclo + 1}` };
}

/**
 * @param {array}  opts.eventos  
 * @param {array}  opts.tipos   
 * @param {number} opts.anio     año del mes
 * @param {number} opts.mes      mes (0–11)
 */
export function construirDatosMensual({ eventos, tipos, anio, mes }) {
  const colorMap = new Map(tipos.map((t) => [t.id, t.color]));
  const etiquetaMap = new Map(tipos.map((t) => [t.id, t.etiqueta]));
  const colorPorTipo = (id) => colorMap.get(id) || COLOR_GRIS;
  const etiquetaPorTipo = (id) => etiquetaMap.get(id) || "Sin tipo";

  const semanas = construirMesDetalle(anio, mes, eventos, colorPorTipo);

  // Tipos que tocan el mes (incluye eventos de varios días).
  const inicioMes = new Date(anio, mes, 1);
  const finMes = new Date(anio, mes + 1, 0);
  const usados = new Set();
  for (const ev of eventos) {
    const ini = desdeClaveFecha(ev.fecha);
    const fin = ev.fechaFin ? desdeClaveFecha(ev.fechaFin) : ini;
    if (fin >= inicioMes && ini <= finMes) usados.add(ev.tipo);
  }
  const simbologia = tipos
    .filter((t) => usados.has(t.id))
    .map((t) => ({ nombre: t.etiqueta, color: t.color }));

  // Lista de actividades
  const lista = eventos
    .filter((ev) => {
      const f = desdeClaveFecha(ev.fecha);
      return f.getFullYear() === anio && f.getMonth() === mes;
    })
    .sort(
      (a, b) =>
        a.fecha.localeCompare(b.fecha) ||
        (a.horaInicio || "").localeCompare(b.horaInicio || "")
    )
    .map((ev) => detalleEvento(ev, colorPorTipo, etiquetaPorTipo));

  return {
    nombreMes: NOMBRES_MES[mes],
    anio,
    mes,
    semanas,
    simbologia,
    eventos: lista,
    ciclo: mes >= 7 ? `${anio} – ${anio + 1}` : `${anio - 1} – ${anio}`,
  };
}
