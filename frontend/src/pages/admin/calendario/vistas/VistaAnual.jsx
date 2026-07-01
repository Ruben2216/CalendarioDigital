import { useMemo } from "react";
import { aClaveFecha, NOMBRES_MES } from "../../../../lib/fechas.js";
import { coloresDeDia } from "../../../../lib/colores.js";
import DiaMulticolor from "../../../../components/dia-multicolor/DiaMulticolor.jsx";
import styles from "./VistaAnual.module.css";

const DIAS_MINI = ["D", "L", "M", "M", "J", "V", "S"];

/* Rejilla fija de 6 semanas para que todos los meses tengan el mismo alto */
const SEMANAS_MES = 6;

/* Construye las celdas (numeros de dia) de un mes */
function construirMes(anio, mes, eventosPorDia, claveHoy) {
  const primerDiaSemana = new Date(anio, mes, 1).getDay();
  const total = SEMANAS_MES * 7;
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
      finde: fecha.getDay() === 0 || fecha.getDay() === 6,
      evs,
    };
  });
}

export default function VistaAnual({
  fechaActual,
  eventosPorDia,
  colorTipo,
  claveHoy,
  fechaSeleccionada,
  mesSeleccionado,
  onSeleccionarDia,
  onSeleccionarMes,
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
        celdas: construirMes(anio, mes, eventosPorDia, claveHoy),
      };
    });
  }, [anioCiclo, eventosPorDia, claveHoy]);

  return (
    <div className={`tarjeta ${styles["anual"]}`}>
      {meses.map((m, k) => (
        <div key={`${m.anio}-${m.mes}`} className={styles["anual__contenedor"]}>
          {/* Insignia de semestre antes de Agosto (A) y de Febrero (B) */}
          {k === 0 && (
            <span className={`etiqueta etiqueta--marino ${styles["anual__semestre"]}`}>
              SEMESTRE {anioCiclo}-A
            </span>
          )}
          {k === 6 && (
            <span className={`etiqueta etiqueta--azul ${styles["anual__semestre"]}`}>
              SEMESTRE {anioCiclo + 1}-B
            </span>
          )}

          <article className={styles["mini"]}>
            {/* Clic en el encabezado del mes (ver los eventos de TODO ese mes) */}
            <button
              type="button"
              onClick={() => onSeleccionarMes(`${m.anio}-${String(m.mes + 1).padStart(2, "0")}`)}
              className={`${styles["mini__cabecera"]} ${
                m.semestreA ? styles["mini__cabecera--a"] : styles["mini__cabecera--b"]
              } ${
                mesSeleccionado === `${m.anio}-${String(m.mes + 1).padStart(2, "0")}`
                  ? styles["mini__cabecera--activo"]
                  : ""
              }`}
            >
              <span className={styles["mini__mes"]}>{NOMBRES_MES[m.mes].toUpperCase()}</span>
              <span className={styles["mini__anio"]}>{m.anio}</span>
            </button>

            <div className={styles["mini__rejilla"]}>
              {DIAS_MINI.map((d, i) => (
                <span key={i} className={styles["mini__dia-semana"]}>{d}</span>
              ))}

              {m.celdas.map((celda) => {
                const colores = celda.delMes ? coloresDeDia(celda.evs, colorTipo) : [];
                const acentos = `${celda.esHoy ? styles["mini__num--hoy"] : ""} ${
                  celda.clave === fechaSeleccionada ? styles["mini__num--sel"] : ""
                }`.trim();
                return (
                  <button
                    type="button"
                    key={celda.clave}
                    onClick={() => onSeleccionarDia(celda.clave)}
                    aria-pressed={celda.clave === fechaSeleccionada}
                    className={`${styles["mini__dia"]} ${celda.delMes ? "" : styles["mini__dia--fuera"]} ${
                      celda.delMes && celda.finde ? styles["mini__dia--finde"] : ""
                    }`}
                  >
                    <DiaMulticolor
                      dia={celda.dia}
                      colores={colores}
                      className={`${styles["mini__num"]} ${acentos}`.trim()}
                      titulo={colores.length ? celda.evs.map((ev) => ev.titulo).join(" · ") : undefined}
                    />
                  </button>
                );
              })}
            </div>
          </article>
        </div>
      ))}
    </div>
  );
}
