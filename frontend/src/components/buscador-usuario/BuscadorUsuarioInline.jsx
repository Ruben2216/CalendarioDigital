import { useEffect, useRef, useState } from "react";
import { buscarUsuarios } from "../../services/authService.js";
import styles from "./BuscadorUsuarioInline.module.css";

export default function BuscadorUsuarioInline({
  value,
  onChange,
  onSeleccionar,
  placeholder = "Buscar usuario por nombre o correo…",
  autoFocus = false,
  required = false,
}) {
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const timerId = useRef(null);

  useEffect(() => {
    const q = (value || "").trim();
    if (q.length < 2) {
      setResultados([]);
      setAbierto(false);
      return;
    }
    clearTimeout(timerId.current);
    timerId.current = setTimeout(async () => {
      setCargando(true);
      try {
        const datos = await buscarUsuarios(q);
        setResultados(datos.slice(0, 10));
        setAbierto(datos.length > 0);
      } catch {
        setResultados([]);
        setAbierto(false);
      } finally {
        setCargando(false);
      }
    }, 300);
    return () => clearTimeout(timerId.current);
  }, [value]);

  const handleSeleccionar = (u) => {
    onSeleccionar(u);
    setAbierto(false);
    setResultados([]);
  };

  return (
    <div className={styles["buscador"]}>
      <input
        autoFocus={autoFocus}
        type="text"
        required={required}
        className={styles["buscador__input"]}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        onFocus={() => { if (resultados.length > 0) setAbierto(true); }}
      />
      {abierto && (
        <div className={styles["buscador__resultados"]}>
          {cargando ? (
            <p className={styles["buscador__estado"]}>Buscando…</p>
          ) : resultados.length > 0 ? (
            resultados.map((u) => (
              <button
                key={u.id}
                type="button"
                className={styles["buscador__item"]}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSeleccionar(u)}
              >
                <span className={styles["buscador__item-nombre"]}>{u.nombre}</span>
                <span className={styles["buscador__item-correo"]}>{u.correo}</span>
              </button>
            ))
          ) : (
            <p className={styles["buscador__estado"]}>Sin resultados</p>
          )}
        </div>
      )}
    </div>
  );
}
