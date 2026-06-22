import { useMemo } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { formatoHora, formatoFechaLarga } from "../../../../lib/fechas.js";
import { alcanceEvento } from "../../../../data/calendario.js";
import styles from "./VistaLista.module.css";

export default function VistaLista({ eventos, fechaActual, colorTipo, etiquetaTipo, onSeleccionarDia, onEditar, onEliminar, soloLectura = false, })
{
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

  return (
    <div className={styles["lista"]}>
      {grupos.map((g) => (
        <div key={g.clave} className={styles["lista__grupo"]}>
          <div className={styles["lista__dia"]}>{formatoFechaLarga(g.clave)}</div>

          <div className={`tarjeta ${styles["lista__tarjeta"]}`}>
            {g.eventos.map((ev) => (
              <div
                key={ev.id}
                className={styles["lista__fila"]}
                onClick={() => onSeleccionarDia(g.clave)}
              >
                <span className={styles["lista__hora"]}>
                  {ev.horaInicio ? formatoHora(ev.horaInicio) : "Todo el día"}
                </span>

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
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
