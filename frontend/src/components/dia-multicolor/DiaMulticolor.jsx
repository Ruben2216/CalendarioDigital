import { MAX_COLORES_DIA, textoLegibleSobre } from "../../lib/colores.js";
import styles from "./DiaMulticolor.module.css";

/* Fondo del cuadro según cuántos colores toquen el día, replicando la
   simbología del PDF: 1 = lleno, 2 = diagonal, 3 = mitades + banda, 4 = cuadrantes. */
function fondoMulticolor(c) {
  switch (c.length) {
    case 1:
      return c[0];
    case 2:
      return `linear-gradient(to bottom right, ${c[0]} 0 49.9%, ${c[1]} 50.1% 100%)`;
    case 3:
      return `linear-gradient(${c[2]} 0 0) bottom / 100% 40% no-repeat,
              linear-gradient(to right, ${c[0]} 0 50%, ${c[1]} 50% 100%)`;
    default:
      return `linear-gradient(to right, ${c[2]} 50%, ${c[3]} 50%) bottom / 100% 50% no-repeat,
              linear-gradient(to right, ${c[0]} 50%, ${c[1]} 50%) top / 100% 50% no-repeat`;
  }
}

export default function DiaMulticolor({ dia, colores = [], className = "", titulo }) {
  const paleta = colores.slice(0, MAX_COLORES_DIA);
  const clases = `${styles["dia"]} ${paleta.length ? styles["dia--pintado"] : ""} ${className}`.trim();

  if (paleta.length === 0) {
    return <span className={clases} title={titulo}>{dia}</span>;
  }

  return (
    <span
      className={clases}
      style={{ background: fondoMulticolor(paleta), color: textoLegibleSobre(paleta) }}
      title={titulo}
    >
      {dia}
    </span>
  );
}
