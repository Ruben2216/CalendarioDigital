import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { NOMBRES_MES, DIAS_SEMANA, aClaveFecha, desdeClaveFecha } from "../../lib/fechas.js";
import styles from "./campos.module.css";

function formatoCorto(clave) {
  if (!clave) return "";
  const [a, m, d] = clave.split("-");
  return `${d}/${m}/${a}`;
}

export default function SelectorFecha({ value, onChange, min, placeholder = "Selecciona el día" }) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState(null);
  const [mesVista, setMesVista] = useState(() => (value ? desdeClaveFecha(value) : new Date()));
  const ref = useRef(null);
  const controlRef = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera, true);
    return () => document.removeEventListener("mousedown", fuera, true);
  }, [abierto]);

  const abrir = () => {
    setMesVista(value ? desdeClaveFecha(value) : new Date());
    const r = controlRef.current.getBoundingClientRect();
    const alto = 300;
    const top = r.bottom + alto > window.innerHeight ? Math.max(8, r.top - alto - 6) : r.bottom + 6;
    setPos({ left: Math.min(r.left, window.innerWidth - 248), top });
    setAbierto(true);
  };

  const irMes = (d) => setMesVista((m) => new Date(m.getFullYear(), m.getMonth() + d, 1));
  const elegir = (clave) => {
    onChange(clave);
    setAbierto(false);
  };

  const anio = mesVista.getFullYear();
  const mes = mesVista.getMonth();
  const primer = new Date(anio, mes, 1).getDay();
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const total = Math.ceil((primer + diasEnMes) / 7) * 7;
  const inicio = new Date(anio, mes, 1 - primer);
  const celdas = Array.from({ length: total }, (_, i) => {
    const f = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
    const clave = aClaveFecha(f);
    return { clave, dia: f.getDate(), delMes: f.getMonth() === mes, deshab: Boolean(min) && clave < min };
  });

  return (
    <div className={styles["campo"]} ref={ref}>
      <button type="button" ref={controlRef} className={styles["campo__control"]} onClick={abrir}>
        <span className={value ? styles["campo__valor"] : styles["campo__placeholder"]}>
          {value ? formatoCorto(value) : placeholder}
        </span>
        <Calendar size={16} />
      </button>

      {abierto && pos && (
        <div className={styles["pop"]} style={{ left: pos.left, top: pos.top }}>
          <div className={styles["pop__cab"]}>
            <button type="button" onClick={() => irMes(-1)} aria-label="Mes anterior">
              <ChevronLeft size={16} />
            </button>
            <span>{NOMBRES_MES[mes]} {anio}</span>
            <button type="button" onClick={() => irMes(1)} aria-label="Mes siguiente">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className={styles["pop__semana"]}>
            {DIAS_SEMANA.map((d, i) => (
              <span key={i}>{d.charAt(0)}</span>
            ))}
          </div>
          <div className={styles["pop__dias"]}>
            {celdas.map((c) => (
              <button
                type="button"
                key={c.clave}
                disabled={c.deshab}
                className={`${styles["dia"]} ${c.delMes ? "" : styles["dia--fuera"]} ${
                  c.clave === value ? styles["dia--sel"] : ""
                }`}
                onClick={() => elegir(c.clave)}
              >
                {c.dia}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
