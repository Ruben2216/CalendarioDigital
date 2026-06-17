import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, MapPin, X, Check, ChevronDown } from "lucide-react";
import { listarPlanteles } from "../../services/plantelesService.js";
import styles from "./SelectorPlantel.module.css";

// Selector de plantel por búsqueda
export default function SelectorPlantel({
  value = "",
  onChange,
  textoTodos = "Todos",
  placeholder = "Buscar plantel…",
}) {
  const [abierto, setAbierto] = useState(false);
  const [query, setQuery] = useState("");
  const [planteles, setPlanteles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [coords, setCoords] = useState(null);
  const controlRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    let vigente = true;
    listarPlanteles()
      .then((lista) => { if (vigente) setPlanteles(lista); })
      .catch(() => { if (vigente) setPlanteles([]); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, []);

  const recalcular = () => {
    const el = controlRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ancho = Math.max(r.width, 300);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8));
    setCoords({ top: r.bottom + 6, left, ancho });
  };

  useEffect(() => {
    const alClic = (e) => {
      if (controlRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setAbierto(false);
    };
    document.addEventListener("mousedown", alClic, true);
    return () => document.removeEventListener("mousedown", alClic, true);
  }, []);

  useEffect(() => {
    if (!abierto) return undefined;
    const alMover = () => recalcular();
    window.addEventListener("resize", alMover);
    window.addEventListener("scroll", alMover, true);
    return () => {
      window.removeEventListener("resize", alMover);
      window.removeEventListener("scroll", alMover, true);
    };
  }, [abierto]);

  const abrir = () => {
    setQuery("");
    recalcular();
    setAbierto(true);
  };

  const elegir = (nombre) => {
    onChange(nombre);
    setAbierto(false);
  };

  const buscando = query.trim().length > 0;
  const termino = query.trim().toLowerCase();
  const disponibles = buscando
    ? planteles.filter((p) => p.nombre.toLowerCase().includes(termino) && p.nombre !== value)
    : [];

  return (
    <div className={styles["selector"]} ref={controlRef}>
      <div className={`${styles["control"]} ${abierto ? styles["control--abierto"] : ""}`}>
        <button
          type="button"
          className={styles["abrir"]}
          onClick={() => (abierto ? setAbierto(false) : abrir())}
          aria-expanded={abierto}
        >
          <MapPin size={14} />
          <span className={value ? styles["valor"] : styles["valor--vacio"]}>
            {value || textoTodos}
          </span>
        </button>
        {value ? (
          <button
            type="button"
            className={styles["limpiar"]}
            onClick={() => onChange("")}
            aria-label="Quitar plantel"
            title="Quitar"
          >
            <X size={14} />
          </button>
        ) : (
          <ChevronDown size={14} className={styles["flecha"]} />
        )}
      </div>

      {abierto && coords && createPortal(
        <div
          ref={panelRef}
          className={styles["panel"]}
          style={{ top: coords.top, left: coords.left, width: coords.ancho }}
        >
          <div className={styles["buscador"]}>
            <Search size={14} />
            <input
              autoFocus
              type="text"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <ul className={styles["opciones"]}>
            {!buscando && (
              <li>
                <button type="button" className={styles["opcion"]} onClick={() => elegir("")}>
                  <span className={styles["check"]}>{value === "" && <Check size={14} />}</span>
                  {textoTodos}
                </button>
              </li>
            )}

            {!buscando ? (
              <li className={styles["estado"]}>Escribe para buscar un plantel…</li>
            ) : cargando ? (
              <li className={styles["estado"]}>Cargando…</li>
            ) : disponibles.length === 0 ? (
              <li className={styles["estado"]}>Sin resultados</li>
            ) : (
              disponibles.map((p) => (
                <li key={p.id}>
                  <button type="button" className={styles["opcion"]} onClick={() => elegir(p.nombre)}>
                    <span className={styles["check"]} />
                    {p.nombre}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
}
