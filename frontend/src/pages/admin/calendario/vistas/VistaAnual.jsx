import { useMemo } from "react";
import { aClaveFecha, NOMBRES_MES } from "../../../../lib/fechas.js";
import styles from "./VistaAnual.module.css";

const DIAS_MINI = ["D", "L", "M", "M", "J", "V", "S"];

/* Construye las celdas (numeros de dia) de un mes */
function construirMes(anio, mes, eventosPorDia, claveHoy, colorTipo) {
  const primerDiaSemana = new Date(anio, mes, 1).getDay();
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const total = Math.ceil((primerDiaSemana + diasEnMes) / 7) * 7;
  const inicio = new Date(anio, mes, 1 - primerDiaSemana);

  return Array.from({ length: total }, (_, i) => {
    const fecha = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
    const clave = aClaveFecha(fecha);
    const evs = eventosPorDia.get(clave) || [];
    return {
      clave,
      dia: fecha.getDate(),
      delMes: fecha.getMonth() === mes,
      esHoy: clave === claveHoy,
      color: evs.length ? colorTipo(evs[0].tipo) : null,
    };
  });
}

export default function VistaAnual({
  fechaActual,
  eventosPorDia,
  colorTipo,
  claveHoy,
  fechaSeleccionada,
  onSeleccionarDia,
}) {
  // Ciclo escolar: si estamos en agosto o después, el ciclo arranca este año, si no, arrancó el año pasado. */
  const anioCiclo = fechaActual.getMonth() >= 7
    ? fechaActual.getFullYear()
    : fechaActual.getFullYear() - 1;

  const meses = useMemo(() => {
    return Array.from({ length: 12 }, (_, k) => {
      const mes = (7 + k) % 12;
      const anio = mes >= 7 ? anioCiclo : anioCiclo + 1;
      return {
        mes,
        anio,
        semestreA: k < 6, // primeros 6 = semestre A
        celdas: construirMes(anio, mes, eventosPorDia, claveHoy, colorTipo),
      };
    });
  }, [anioCiclo, eventosPorDia, claveHoy]);

  return (
    <div className={`tarjeta ${styles["anual"]}`}>
      {meses.map((m, k) => (
        <div key={`${m.anio}-${m.mes}`} className={styles["anual__contenedor"]}>
          {/* Insignia de semestre antes de Agosto (A) y de Febrero (B) */}
          {k === 0 && (
            <span className={`etiqueta etiqueta--rojo ${styles["anual__semestre"]}`}>
              SEMESTRE {anioCiclo}-A
            </span>
          )}
          {k === 6 && (
            <span className={`etiqueta etiqueta--teal ${styles["anual__semestre"]}`}>
              SEMESTRE {anioCiclo + 1}-B
            </span>
          )}

          <article className={styles["mini"]}>
            <header className={`${styles["mini__cabecera"]} ${m.semestreA ? styles["mini__cabecera--a"] : styles["mini__cabecera--b"]}`}>
              <span className={styles["mini__mes"]}>{NOMBRES_MES[m.mes].toUpperCase()}</span>
              <span className={styles["mini__anio"]}>{m.anio}</span>
            </header>

            <div className={styles["mini__rejilla"]}>
              {DIAS_MINI.map((d, i) => (
                <span key={i} className={styles["mini__dia-semana"]}>{d}</span>
              ))}

              {m.celdas.map((celda) => (
                <button
                  type="button"
                  key={celda.clave}
                  onClick={() => onSeleccionarDia(celda.clave)}
                  aria-pressed={celda.clave === fechaSeleccionada}
                  className={`${styles["mini__dia"]} ${celda.delMes ? "" : styles["mini__dia--fuera"]} ${
                    celda.esHoy ? styles["mini__dia--hoy"] : ""
                  } ${celda.clave === fechaSeleccionada ? styles["mini__dia--sel"] : ""} ${
                    celda.color ? styles[`mini__dia--${celda.color}`] : ""
                  }`}
                >
                  {celda.dia}
                </button>
              ))}
            </div>
          </article>
        </div>
      ))}
    </div>
  );
}
