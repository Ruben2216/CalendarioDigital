import { useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import {
  NOMBRES_MES, ahoraMexico, aClaveFecha, desdeClaveFecha, formatoHora, formatoFechaLarga,
} from "../../lib/fechas.js";
import styles from "./MiniCalendario.module.css";

const DIAS_MINI = ["D", "L", "M", "M", "J", "V", "S"];

export default function MiniCalendario({
  eventos = [],
  tipos = [],
  calendarios = [],
  calendarioActivo = null,
  onCalendario,
}) {
  const tiposMap = useMemo(() => Object.fromEntries(tipos.map((t) => [t.id, t])), [tipos]);
  const colorTipo = (id) => tiposMap[id]?.color ?? "gris";
  const etiquetaTipo = (id) => tiposMap[id]?.etiqueta ?? "Evento";

  const hoy = useMemo(() => ahoraMexico(), []);
  const claveHoy = aClaveFecha(hoy);

  const [mesVisible, setMesVisible] = useState(
    () => new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  );
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null);

  const eventosPorFecha = useMemo(() => {
    const mapa = new Map();
    for (const ev of eventos) {
      if (!mapa.has(ev.fecha)) mapa.set(ev.fecha, []);
      mapa.get(ev.fecha).push(ev);
    }
    return mapa;
  }, [eventos]);

  const eventosDelDia = fechaSeleccionada
    ? eventosPorFecha.get(fechaSeleccionada) || []
    : [];

  const celdas = useMemo(() => {
    const anio = mesVisible.getFullYear();
    const mes = mesVisible.getMonth();
    const primerDiaSemana = new Date(anio, mes, 1).getDay();
    const inicio = new Date(anio, mes, 1 - primerDiaSemana);
    return Array.from({ length: 42 }, (_, i) => {
      const fecha = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
      const clave = aClaveFecha(fecha);
      const evs = eventosPorFecha.get(clave) || [];
      return {
        clave,
        dia: fecha.getDate(),
        delMes: fecha.getMonth() === mes,
        esHoy: clave === claveHoy,
        color: evs.length ? colorTipo(evs[0].tipo) : null,
      };
    });
  }, [mesVisible, eventosPorFecha, claveHoy]);

  const irMes = (delta) =>
    setMesVisible((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  const irHoy = () => setMesVisible(new Date(hoy.getFullYear(), hoy.getMonth(), 1));

  const manejarClickDia = (celda) => {
    setFechaSeleccionada(celda.clave);
    if (!celda.delMes) {
      const fecha = desdeClaveFecha(celda.clave);
      setMesVisible(new Date(fecha.getFullYear(), fecha.getMonth(), 1));
    }
  };

  return (
    <article className={`tarjeta ${styles["calendario"]}`}>
      <div className={styles["calendario__cabecera"]}>
        {calendarios.length > 0 && onCalendario ? (
          <select
            className={styles["calendario__selector"]}
            value={calendarioActivo ?? ""}
            onChange={(e) => onCalendario(Number(e.target.value))}
            aria-label="Seleccionar calendario"
          >
            {calendarios.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre} · {c.ciclo}</option>
            ))}
          </select>
        ) : (
          <div className="tarjeta__titulo">
            <Calendar size={16} />
            Calendario
          </div>
        )}
        <div className={styles["calendario__controles"]}>
          <button type="button" className={styles["calendario__nav"]} onClick={() => irMes(-1)} aria-label="Mes anterior">
            <ChevronLeft size={14} />
          </button>
          <button type="button" className={styles["calendario__hoy"]} onClick={irHoy}>
            Hoy
          </button>
          <button type="button" className={styles["calendario__nav"]} onClick={() => irMes(1)} aria-label="Mes siguiente">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className={styles["calendario__cuerpo"]}>
        <h3 className={styles["calendario__mes"]}>
          {NOMBRES_MES[mesVisible.getMonth()]} {mesVisible.getFullYear()}
        </h3>

        <div className={styles["calendario__rejilla"]}>
          {DIAS_MINI.map((dia, i) => (
            <span key={i} className={styles["calendario__dia-semana"]}>{dia}</span>
          ))}

          {celdas.map((celda) => (
            <button
              type="button"
              key={celda.clave}
              onClick={() => manejarClickDia(celda)}
              aria-pressed={fechaSeleccionada === celda.clave}
              className={`${styles["dia"]} ${celda.delMes ? "" : styles["dia--apagado"]} ${
                celda.esHoy ? styles["dia--hoy"] : ""
              } ${celda.color ? styles[`dia--${celda.color}`] : ""} ${
                fechaSeleccionada === celda.clave ? styles["dia--seleccionado"] : ""
              }`}
            >
              {celda.dia}
            </button>
          ))}
        </div>
      </div>

      {fechaSeleccionada && (
        <div className={styles["dia-eventos"]}>
          <div className={styles["dia-eventos__cabecera"]}>
            <span className={styles["dia-eventos__titulo"]}>
              {formatoFechaLarga(fechaSeleccionada)}
            </span>
            <button
              type="button"
              className={styles["dia-eventos__limpiar"]}
              onClick={() => setFechaSeleccionada(null)}
            >
              Limpiar
            </button>
          </div>

          {eventosDelDia.length === 0 ? (
            <p className={styles["dia-eventos__vacio"]}>No hay eventos para este día.</p>
          ) : (
            <ul className={styles["dia-eventos__lista"]}>
              {eventosDelDia.map((ev) => (
                <li key={ev.id} className={styles["dia-eventos__item"]}>
                  <span className={`${styles["dia-eventos__marca"]} ${styles[`dia-eventos__marca--${colorTipo(ev.tipo)}`]}`} />
                  <div className={styles["dia-eventos__copia"]}>
                    <p className={styles["dia-eventos__nombre"]}>{ev.titulo}</p>
                    <div className={styles["dia-eventos__meta"]}>
                      <span className={`etiqueta etiqueta--${colorTipo(ev.tipo)}`}>
                        {etiquetaTipo(ev.tipo)}
                      </span>
                      {ev.horaInicio && (
                        <span className={styles["meta"]}>
                          <Clock size={11} />
                          {formatoHora(ev.horaInicio)}
                        </span>
                      )}
                      {ev.lugar && (
                        <span className={styles["meta"]}>
                          <MapPin size={11} />
                          {ev.lugar}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className={styles["calendario__leyenda"]}>
        {tipos.map((t) => (
          <span key={t.id} className={styles["leyenda"]}>
            <span className={`${styles["leyenda__punto"]} ${styles[`leyenda__punto--${t.color}`]}`} />
            {t.etiqueta}
          </span>
        ))}
      </div>
    </article>
  );
}
