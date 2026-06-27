import { useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, Clock, MapPin, Tag } from "lucide-react";
import {
  NOMBRES_MES, ahoraMexico, aClaveFecha, desdeClaveFecha, formatoHora, formatoFechaLarga,
} from "../../lib/fechas.js";
import { usePreferencia } from "../../hooks/usePreferencia.js";
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
  const colorTipo = (id) => tiposMap[id]?.color ?? "#64748b";
  const etiquetaTipo = (id) => tiposMap[id]?.etiqueta ?? "Evento";

  const hoy = useMemo(() => ahoraMexico(), []);
  const claveHoy = aClaveFecha(hoy);

  const [mesVisible, setMesVisible] = useState(
    () => new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  );
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null);
  const [simbologiaAbierta, setSimbologiaAbierta] = usePreferencia("mini:simbologia", false);

  const eventosPorFecha = useMemo(() => {
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
    if (celda.clave === fechaSeleccionada) {
      setFechaSeleccionada(null);
      return;
    }
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
              style={celda.color ? { "--punto-color": celda.color } : undefined}
              className={`${styles["dia"]} ${celda.delMes ? "" : styles["dia--apagado"]} ${
                celda.esHoy ? styles["dia--hoy"] : ""
              } ${fechaSeleccionada === celda.clave ? styles["dia--seleccionado"] : ""}`}
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
          </div>

          {eventosDelDia.length === 0 ? (
            <p className={styles["dia-eventos__vacio"]}>No hay eventos para este día.</p>
          ) : (
            <ul className={styles["dia-eventos__lista"]}>
              {eventosDelDia.map((ev) => {
                const etiq = etiquetaTipo(ev.tipo);
                const tieneTituloReal = ev.titulo && ev.titulo !== etiq;
                return (
                <li key={ev.id} className={styles["dia-eventos__item"]}>
                  <div className={styles["dia-eventos__copia"]}>
                    <p
                      className={styles["dia-eventos__nombre"]}
                      style={!tieneTituloReal ? { color: colorTipo(ev.tipo) } : undefined}
                    >
                      {tieneTituloReal ? ev.titulo : etiq}
                    </p>
                    <div className={styles["dia-eventos__meta"]}>
                      {tieneTituloReal && (
                        <span className="etiqueta" style={{ backgroundColor: colorTipo(ev.tipo) + '20', color: colorTipo(ev.tipo) }}>
                          {etiq}
                        </span>
                      )}
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
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className={styles["simbologia"]}>
        <button
          type="button"
          className={styles["simbologia__toggle"]}
          onClick={() => setSimbologiaAbierta((v) => !v)}
          aria-expanded={simbologiaAbierta}
        >
          <span className={styles["simbologia__titulo"]}>
            <Tag size={14} />
            Simbología
          </span>
          <ChevronDown
            size={15}
            className={`${styles["simbologia__chevron"]} ${simbologiaAbierta ? styles["simbologia__chevron--abierto"] : ""}`}
          />
        </button>
        {simbologiaAbierta && (
          <ul className={styles["simbologia__lista"]}>
            {tipos.map((t) => (
              <li key={t.id} className={styles["simbologia__item"]}>
                <span className={styles["simbologia__punto"]} style={{ backgroundColor: t.color }} />
                {t.etiqueta}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
