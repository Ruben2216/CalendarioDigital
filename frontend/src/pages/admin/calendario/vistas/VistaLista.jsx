import { useMemo, useState } from "react";
import { Pencil, Trash2, ChevronDown } from "lucide-react";
import { formatoHora, formatoFechaLarga, aClaveFecha, ahoraMexico } from "../../../../lib/fechas.js";
import { alcanceEvento } from "../../../../data/calendario.js";
import styles from "./VistaLista.module.css";

export default function VistaLista({ eventos, fechaActual, colorTipo, etiquetaTipo, onSeleccionarDia, onEditar, onEliminar, soloLectura = false, })
{
  const [colapsados, setColapsados] = useState(() => new Set());

  const claveHoy = useMemo(() => aClaveFecha(ahoraMexico()), []);

  const alternarDia = (clave) =>
    setColapsados((prev) => {
      const sig = new Set(prev);
      if (sig.has(clave)) sig.delete(clave);
      else sig.add(clave);
      return sig;
    });

  // Eventos del mes visible, agrupados por su día de inicio */
  const grupos = useMemo(() => {
    const mes = fechaActual.getMonth();
    const anio = fechaActual.getFullYear();
    const mapa = new Map();
    for (const ev of eventos) {
      const [a, m] = ev.fecha.split("-").map(Number);
      if (a !== anio || m - 1 !== mes) continue;
      if (!mapa.has(ev.fecha)) mapa.set(ev.fecha, []);
      mapa.get(ev.fecha).push(ev);
    }
    return [...mapa.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([clave, evs]) => ({
        clave,
        eventos: evs.sort((x, y) => (x.horaInicio || "").localeCompare(y.horaInicio || "")),
      }));
  }, [eventos, fechaActual]);

  if (grupos.length === 0) {
    return (
      <div className={`tarjeta ${styles["lista"]}`}>
        <p className={styles["lista__vacio"]}>No hay eventos en este mes.</p>
      </div>
    );
  }

  const todosColapsados = grupos.every((g) => colapsados.has(g.clave));
  const alternarTodos = () =>
    setColapsados(todosColapsados ? new Set() : new Set(grupos.map((g) => g.clave)));

  return (
    <div className={styles["lista"]}>
      <div className={styles["lista__barra"]}>
        <button type="button" className={styles["lista__toggle-todos"]} onClick={alternarTodos}>
          {todosColapsados ? "Expandir todo" : "Contraer todo"}
        </button>
      </div>

      {grupos.map((g) => {
        const colapsado = colapsados.has(g.clave);
        const esHoy = g.clave === claveHoy;
        return (
        <div key={g.clave} className={styles["lista__grupo"]}>
          <button
            type="button"
            className={`${styles["lista__dia"]} ${esHoy ? styles["lista__dia--hoy"] : ""}`}
            onClick={() => alternarDia(g.clave)}
            aria-expanded={!colapsado}
          >
            <ChevronDown
              size={18}
              className={`${styles["lista__chevron"]} ${colapsado ? styles["lista__chevron--cerrado"] : ""}`}
            />
            <span className={styles["lista__dia-texto"]}>{formatoFechaLarga(g.clave)}</span>
            {esHoy && <span className={styles["lista__hoy-badge"]}>Hoy</span>}
            <span className={styles["lista__conteo"]}>
              {g.eventos.length} {g.eventos.length === 1 ? "evento" : "eventos"}
            </span>
          </button>

          {!colapsado && (
          <div className={`tarjeta ${styles["lista__tarjeta"]}`}>
            {g.eventos.map((ev) => (
              <div
                key={ev.id}
                className={styles["lista__fila"]}
                onClick={() => onSeleccionarDia(g.clave)}
              >
                <div className={styles["lista__cab"]}>
                  <span className={styles["lista__hora"]}>
                    {ev.horaInicio ? formatoHora(ev.horaInicio) : "Todo el día"}
                  </span>

                  {!soloLectura && (
                    <div className={styles["lista__acciones"]}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onEditar(ev); }}
                        aria-label="Editar"
                        title="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className={styles["lista__borrar"]}
                        onClick={(e) => { e.stopPropagation(); onEliminar(ev); }}
                        aria-label="Eliminar"
                        title="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>

                <div className={styles["lista__info"]}>
                  <span className={styles["lista__titulo"]}>{ev.titulo}</span>
                  <span className={styles["lista__sub"]}>
                    {[
                      ev.area,
                      ev.lugar,
                      ev.plantel,
                      ev.turno,
                      (ev.semestre != null || ev.grupo != null) ? alcanceEvento(ev) : null,
                    ].filter(Boolean).join(" · ")}
                  </span>
                </div>

                <span
                  className={`etiqueta ${styles["lista__tipo"]}`}
                  style={{ backgroundColor: colorTipo(ev.tipo) + '20', color: colorTipo(ev.tipo) }}
                >
                  {etiquetaTipo(ev.tipo)}
                </span>
              </div>
            ))}
          </div>
          )}
        </div>
        );
      })}
    </div>
  );
}
