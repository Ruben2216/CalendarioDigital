import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, MapPin, X, Check, ChevronDown } from "lucide-react";
import { listarPlanteles } from "../../services/plantelesService.js";
import { useCargaAsync } from "../../hooks/useCargaAsync.js";
import { useClicFuera } from "../../hooks/useClicFuera.js";
import styles from "./SelectorPlantel.module.css";

// Selector de plantel por búsqueda
export default function SelectorPlantel({
  value = "",
  onChange,
  textoTodos = "Todos",
  placeholder = "Buscar plantel…",
  planteles: plantelesProp,
}) {
  const [abierto, setAbierto] = useState(false);
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState(null);
  const controlRef = useRef(null);
  const panelRef = useRef(null);

  const { datos, cargando } = useCargaAsync(
    plantelesProp ? () => Promise.resolve(plantelesProp) : listarPlanteles,
    [plantelesProp]
  );
  const planteles = datos ?? [];

  const recalcular = () => {
    const el = controlRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ancho = Math.max(r.width, 300);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8));
    setCoords({ top: r.bottom + 6, left, ancho });
  };

  useClicFuera([controlRef, panelRef], true, () => setAbierto(false));

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
  const terminoNumerico = /^\d+$/.test(termino);

  const numeroPlantel = (nombre) => (nombre.match(/\d+/) ?? [''])[0];

  const coincide = (p) => {
    if (p.nombre === value) return false;
    if (terminoNumerico) return numeroPlantel(p.nombre).startsWith(termino);
    return p.nombre.toLowerCase().includes(termino);
  };

  // Si el término es numérico, ordena poniendo el número exacto primero y luego ascendente
  const sortPorNumero = (a, b) => {
    if (!terminoNumerico) return a.nombre.localeCompare(b.nombre);
    const nA = numeroPlantel(a.nombre) || '0';
    const nB = numeroPlantel(b.nombre) || '0';
    if ((nA === termino) !== (nB === termino)) return nA === termino ? -1 : 1;
    return parseInt(nA) - parseInt(nB);
  };

  const disponibles = buscando
    ? planteles.filter(coincide).sort(sortPorNumero)
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
