import { useMemo } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { DIAS_SEMANA, formatoHora, formatoFechaLarga } from "../../../../lib/fechas.js";
import styles from "./VistaMesMovil.module.css";

export default function VistaMesMovil({
  fechaActual,
  eventosPorDia,
  colorTipo,
  etiquetaTipo,
  claveHoy,
  fechaSeleccionada,
  onSeleccionarDia,
  soloLectura = false,
  onEditar,
  onEliminar,
}) {
  const anio = fechaActual.getFullYear();
  const mes = fechaActual.getMonth();

  const celdas = useMemo(() => {
    const primerDia = new Date(anio, mes, 1).getDay();
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    const resultado = [];

    for (let i = 0; i < primerDia; i++) {
      resultado.push({ clave: null });
    }
    for (let d = 1; d <= diasEnMes; d++) {
      const clave = `${anio}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      resultado.push({ clave, numero: d });
    }
    return resultado;
  }, [anio, mes]);

  const eventosDelDia = fechaSeleccionada ? (eventosPorDia.get(fechaSeleccionada) || []) : [];
  const tituloPanel = fechaSeleccionada ? formatoFechaLarga(fechaSeleccionada) : "Selecciona un día";

  return (
    <div className={styles["mes-movil"]}>
      <div className={`tarjeta ${styles["mes-movil__cal"]}`}>
        <div className={styles["mes-movil__cabecera"]}>
          {DIAS_SEMANA.map((d, i) => (
            <span key={d} className={`${styles["mes-movil__dia-label"]} ${i === 0 || i === 6 ? styles["mes-movil__dia-label--finde"] : ""}`}>
              {d}
            </span>
          ))}
        </div>

        <div className={styles["mes-movil__grid"]}>
          {celdas.map((celda, idx) => {
            if (!celda.clave) {
              return <span key={`v${idx}`} className={styles["mes-movil__celda"]} aria-hidden="true" />;
            }
            const eventos = eventosPorDia.get(celda.clave) || [];
            const esHoy = celda.clave === claveHoy;
            const esSelec = celda.clave === fechaSeleccionada;
            return (
              <button
                key={celda.clave}
                type="button"
                className={[
                  styles["mes-movil__celda"],
                  esHoy && !esSelec ? styles["mes-movil__celda--hoy"] : "",
                  esSelec ? styles["mes-movil__celda--selec"] : "",
                ].join(" ")}
                onClick={() => onSeleccionarDia(celda.clave)}
                aria-label={`${celda.numero}${esHoy ? ", hoy" : ""}${eventos.length ? `, ${eventos.length} eventos` : ""}`}
              >
                <span className={`${styles["mes-movil__num"]} ${idx % 7 === 0 || idx % 7 === 6 ? styles["mes-movil__num--finde"] : ""}`}>{celda.numero}</span>
                <span className={styles["mes-movil__puntos"]}>
                  {eventos.slice(0, 3).map((ev, i) => (
                    <span
                      key={i}
                      className={styles["mes-movil__punto"]}
                      style={{ backgroundColor: colorTipo(ev.tipo) }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles["mes-movil__eventos"]}>
        <div className={styles["mes-movil__eventos-cab"]}>
          <h3 className={styles["mes-movil__eventos-titulo"]}>{tituloPanel}</h3>
          <span className={styles["mes-movil__eventos-conteo"]}>
            {eventosDelDia.length} {eventosDelDia.length === 1 ? "evento" : "eventos"}
          </span>
        </div>

        {eventosDelDia.length === 0 ? (
          <p className={styles["mes-movil__vacio"]}>
            {fechaSeleccionada ? "No hay eventos para este día." : "Toca un día para ver sus eventos."}
          </p>
        ) : (
          <div className={styles["mes-movil__lista"]}>
            {eventosDelDia.map((ev) => (
              <div key={ev.id} className={styles["mes-movil__item"]}>
                <span
                  className={styles["mes-movil__item-barra"]}
                  style={{ backgroundColor: colorTipo(ev.tipo) }}
                />
                <div className={styles["mes-movil__item-info"]}>
                  <span className={styles["mes-movil__item-titulo"]}>{ev.titulo}</span>
                  <span className={styles["mes-movil__item-hora"]}>
                    {ev.horaInicio ? formatoHora(ev.horaInicio) : "Todo el día"}
                    {ev.lugar ? ` · ${ev.lugar}` : ""}
                  </span>
                  <span
                    className={`etiqueta ${styles["mes-movil__item-tipo"]}`}
                    style={{ backgroundColor: colorTipo(ev.tipo) + "20", color: colorTipo(ev.tipo) }}
                  >
                    {etiquetaTipo(ev.tipo)}
                  </span>
                </div>
                {!soloLectura && ev.puede_editar && (
                  <div className={styles["mes-movil__item-acciones"]}>
                    <button type="button" onClick={() => onEditar(ev)} aria-label="Editar" title="Editar">
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className={styles["mes-movil__item-borrar"]}
                      onClick={() => onEliminar(ev)}
                      aria-label="Eliminar"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
