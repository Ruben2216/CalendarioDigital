import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import styles from "./campos.module.css";

const HORAS12 = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTOS = ["00", "15", "30", "45"];

function a12(valor) {
  if (!valor) return null;
  const [H, M] = valor.split(":").map(Number);
  return {
    h12: H % 12 === 0 ? 12 : H % 12,
    m: String(M).padStart(2, "0"),
    ampm: H >= 12 ? "PM" : "AM",
  };
}

function a24(h12, m, ampm) {
  let H = h12 % 12;
  if (ampm === "PM") H += 12;
  return `${String(H).padStart(2, "0")}:${m}`;
}

export default function SelectorHora({ value, onChange, placeholder = "Hora" }) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const controlRef = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  const actual = a12(value);
  const h12 = actual?.h12 ?? 9;
  const m = actual?.m ?? "00";
  const ampm = actual?.ampm ?? "AM";

  const abrir = () => {
    const r = controlRef.current.getBoundingClientRect();
    const alto = 230;
    const top = r.bottom + alto > window.innerHeight ? Math.max(8, r.top - alto - 6) : r.bottom + 6;
    setPos({ left: Math.min(r.left, window.innerWidth - 210), top });
    setAbierto((v) => !v);
  };

  const fijar = (nh, nm, nap) => onChange(a24(nh, nm, nap));

  return (
    <div className={styles["campo"]} ref={ref}>
      <button type="button" ref={controlRef} className={styles["campo__control"]} onClick={abrir}>
        <span className={value ? styles["campo__valor"] : styles["campo__placeholder"]}>
          {value ? `${h12}:${m} ${ampm}` : placeholder}
        </span>
        <Clock size={16} />
      </button>

      {abierto && pos && (
        <div className={`${styles["pop"]} ${styles["pop--hora"]}`} style={{ left: pos.left, top: pos.top }}>
          <div className={styles["hora"]}>
            <div className={styles["hora__col"]}>
              {HORAS12.map((h) => (
                <button
                  type="button"
                  key={h}
                  className={`${styles["hora__op"]} ${value && h === h12 ? styles["hora__op--sel"] : ""}`}
                  onClick={() => fijar(h, m, ampm)}
                >
                  {String(h).padStart(2, "0")}
                </button>
              ))}
            </div>
            <div className={styles["hora__col"]}>
              {MINUTOS.map((mm) => (
                <button
                  type="button"
                  key={mm}
                  className={`${styles["hora__op"]} ${value && mm === m ? styles["hora__op--sel"] : ""}`}
                  onClick={() => fijar(h12, mm, ampm)}
                >
                  {mm}
                </button>
              ))}
            </div>
            <div className={styles["hora__ampm"]}>
              <button
                type="button"
                className={`${styles["hora__op"]} ${ampm === "AM" ? styles["hora__op--sel"] : ""}`}
                onClick={() => fijar(h12, m, "AM")}
              >
                AM
              </button>
              <button
                type="button"
                className={`${styles["hora__op"]} ${ampm === "PM" ? styles["hora__op--sel"] : ""}`}
                onClick={() => fijar(h12, m, "PM")}
              >
                PM
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
