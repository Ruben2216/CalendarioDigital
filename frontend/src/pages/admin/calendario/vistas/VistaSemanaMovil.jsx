import { useEffect, useMemo } from "react";
import { Clock, Pencil, Trash2 } from "lucide-react";
import {
  DIAS_SEMANA, aClaveFecha, sumarDias, minutosDe, formatoHora, formatoFechaLarga, ahoraMexico,
} from "../../../../lib/fechas.js";
import styles from "./VistaSemanaMovil.module.css";

const ALTO_HORA = 64;        
const MIN_ALTO_EVENTO = 42;  
const HORA_DEF_INI = 7;     
const HORA_DEF_FIN = 19;

// Vista de semana para móvil
export default function VistaSemanaMovil({
  fechaActual,
  eventosPorDia,
  colorTipo,
  claveHoy,
  fechaSeleccionada,
  onSeleccionarDia,
  soloLectura = false,
  onEditar,
  onEliminar,
  onVerDetalle,
}) {
  const dias = useMemo(() => {
    const inicio = sumarDias(fechaActual, -fechaActual.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const fecha = sumarDias(inicio, i);
      return { clave: aClaveFecha(fecha), numero: fecha.getDate(), indiceDia: fecha.getDay() };
    });
  }, [fechaActual]);

  const clavesSemana = useMemo(() => dias.map((d) => d.clave), [dias]);

  useEffect(() => {
    if (fechaSeleccionada && clavesSemana.includes(fechaSeleccionada)) return;
    const destino = clavesSemana.includes(claveHoy) ? claveHoy : clavesSemana[0];
    if (destino) onSeleccionarDia(destino);
  }, [clavesSemana, claveHoy, fechaSeleccionada, onSeleccionarDia]);

  const eventosDelDia = useMemo(
    () => (fechaSeleccionada ? (eventosPorDia.get(fechaSeleccionada) || []) : []),
    [eventosPorDia, fechaSeleccionada]
  );
  const todoElDia = useMemo(() => eventosDelDia.filter((ev) => !ev.horaInicio), [eventosDelDia]);

  const { bloques, horas, altoTotal, minHora } = useMemo(() => {
    const conMin = eventosDelDia
      .filter((ev) => ev.horaInicio)
      .map((ev) => {
        const ini = minutosDe(ev.horaInicio);
        const fin = ev.horaFin ? Math.max(minutosDe(ev.horaFin), ini + 30) : ini + 60;
        return { ev, ini, fin };
      })
      .sort((a, b) => a.ini - b.ini || a.fin - b.fin);

    let hIni = HORA_DEF_INI;
    let hFin = HORA_DEF_FIN;
    for (const b of conMin) {
      hIni = Math.min(hIni, Math.floor(b.ini / 60));
      hFin = Math.max(hFin, Math.ceil(b.fin / 60));
    }
    hIni = Math.max(0, hIni);
    hFin = Math.min(24, hFin);

    const clusters = [];
    let actual = null;
    for (const b of conMin) {
      if (actual && b.ini < actual.maxFin) {
        actual.items.push(b);
        actual.maxFin = Math.max(actual.maxFin, b.fin);
      } else {
        actual = { items: [b], maxFin: b.fin };
        clusters.push(actual);
      }
    }
    for (const cl of clusters) {
      const carriles = [];
      for (const b of cl.items) {
        let col = carriles.findIndex((fin) => b.ini >= fin);
        if (col === -1) { col = carriles.length; carriles.push(b.fin); }
        else carriles[col] = b.fin;
        b.col = col;
      }
      for (const b of cl.items) b.cols = carriles.length;
    }

    return {
      bloques: conMin,
      horas: Array.from({ length: hFin - hIni + 1 }, (_, i) => hIni + i),
      altoTotal: (hFin - hIni) * ALTO_HORA,
      minHora: hIni,
    };
  }, [eventosDelDia]);

  const ahora = ahoraMexico();
  const ahoraMin = ahora.getHours() * 60 + ahora.getMinutes();
  const mostrarAhora =
    fechaSeleccionada === claveHoy &&
    ahoraMin >= minHora * 60 &&
    ahoraMin <= (minHora + horas.length - 1) * 60;
  const topAhora = ((ahoraMin - minHora * 60) / 60) * ALTO_HORA;

  const tituloPanel = fechaSeleccionada ? formatoFechaLarga(fechaSeleccionada) : "Selecciona un día";

  return (
    <div className={styles["sem-movil"]}>
      {/* Tira de días de la semana */}
      <div className={styles["sem-movil__tira"]}>
        {dias.map((d) => {
          const eventos = eventosPorDia.get(d.clave) || [];
          const esHoy = d.clave === claveHoy;
          const esSelec = d.clave === fechaSeleccionada;
          return (
            <button
              key={d.clave}
              type="button"
              className={[
                styles["sem-movil__dia"],
                esHoy && !esSelec ? styles["sem-movil__dia--hoy"] : "",
                esSelec ? styles["sem-movil__dia--selec"] : "",
              ].join(" ")}
              onClick={() => onSeleccionarDia(d.clave)}
              aria-pressed={esSelec}
            >
              <span
                className={`${styles["sem-movil__dia-label"]} ${d.indiceDia === 0 || d.indiceDia === 6 ? styles["sem-movil__dia-label--finde"] : ""}`}
              >
                {DIAS_SEMANA[d.indiceDia]}
              </span>
              <span className={styles["sem-movil__dia-num"]}>{d.numero}</span>
              <span className={styles["sem-movil__dia-punto"]}>
                {eventos.length > 0 && (
                  <span
                    className={styles["sem-movil__punto"]}
                    style={{ backgroundColor: esSelec ? "#fff" : colorTipo(eventos[0].tipo) }}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Cabecera del día */}
      <div className={styles["sem-movil__cab"]}>
        <h3 className={styles["sem-movil__cab-titulo"]}>{tituloPanel}</h3>
        <span className={styles["sem-movil__cab-conteo"]}>
          {eventosDelDia.length} {eventosDelDia.length === 1 ? "evento" : "eventos"}
        </span>
      </div>

      {/* Eventos de todo el día */}
      {todoElDia.length > 0 && (
        <div className={styles["sem-movil__todo-dia"]}>
          {todoElDia.map((ev) => {
            const editable = !soloLectura && ev.puede_editar;
            return (
              <div
                key={ev.id}
                className={`${styles["sem-movil__chip"]} ${styles["sem-movil__evt--editable"]}`}
                style={{ backgroundColor: colorTipo(ev.tipo) + "1A", borderColor: colorTipo(ev.tipo) }}
                onClick={() => onVerDetalle(ev)}
                role="button"
                tabIndex={0}
                title="Ver detalles"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onVerDetalle(ev); }
                }}
              >
                <span className={styles["sem-movil__chip-punto"]} style={{ backgroundColor: colorTipo(ev.tipo) }} />
                <span className={styles["sem-movil__chip-titulo"]} style={{ color: colorTipo(ev.tipo) }}>
                  {ev.titulo}
                </span>
                <span className={styles["sem-movil__chip-tag"]}>Todo el día</span>
                {editable && (
                  <span className={styles["sem-movil__chip-acciones"]}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onEditar(ev); }}
                      aria-label="Editar"
                      title="Editar"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      className={styles["sem-movil__borrar"]}
                      onClick={(e) => { e.stopPropagation(); onEliminar(ev); }}
                      aria-label="Eliminar"
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Línea de tiempo */}
      <div className={styles["sem-movil__tl"]} style={{ height: altoTotal }}>
        {horas.map((h, i) => (
          <div key={h} className={styles["sem-movil__hora"]} style={{ top: i * ALTO_HORA }}>
            <span className={styles["sem-movil__hora-label"]}>
              {formatoHora(`${String(h).padStart(2, "0")}:00`)}
            </span>
            <span className={styles["sem-movil__hora-linea"]} />
          </div>
        ))}

        <div className={styles["sem-movil__capa"]}>
          {mostrarAhora && (
            <div className={styles["sem-movil__ahora"]} style={{ top: topAhora }}>
              <span className={styles["sem-movil__ahora-punto"]} />
            </div>
          )}

          {bloques.map(({ ev, ini, fin, col, cols }) => {
            const top = ((ini - minHora * 60) / 60) * ALTO_HORA;
            const alto = Math.max(MIN_ALTO_EVENTO, ((fin - ini) / 60) * ALTO_HORA);
            const color = colorTipo(ev.tipo);
            const editable = !soloLectura && ev.puede_editar;
            return (
              <div
                key={ev.id}
                className={`${styles["sem-movil__evt"]} ${styles["sem-movil__evt--editable"]}`}
                style={{
                  top,
                  height: alto - 4,
                  left: `${(col / cols) * 100}%`,
                  width: `calc(${100 / cols}% - 4px)`,
                  backgroundColor: color + "1A",
                  borderColor: color,
                }}
                onClick={() => onVerDetalle(ev)}
                role="button"
                tabIndex={0}
                title="Ver detalles"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onVerDetalle(ev); }
                }}
              >
                <div className={styles["sem-movil__evt-cab"]}>
                  <span className={styles["sem-movil__evt-titulo"]} style={{ color }}>
                    {ev.titulo}
                  </span>
                  {editable && (
                    <span className={styles["sem-movil__evt-acciones"]}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onEditar(ev); }}
                        aria-label="Editar"
                        title="Editar"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className={styles["sem-movil__borrar"]}
                        onClick={(e) => { e.stopPropagation(); onEliminar(ev); }}
                        aria-label="Eliminar"
                        title="Eliminar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </span>
                  )}
                </div>
                <span className={styles["sem-movil__evt-hora"]}>
                  <Clock size={11} />
                  {formatoHora(ev.horaInicio)}
                  {ev.horaFin ? ` - ${formatoHora(ev.horaFin)}` : ""}
                </span>
                {cols === 1 && ev.lugar && alto > 64 && (
                  <span className={styles["sem-movil__evt-lugar"]}>{ev.lugar}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
