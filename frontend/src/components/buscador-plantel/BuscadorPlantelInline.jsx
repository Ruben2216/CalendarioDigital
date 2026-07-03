import { useEffect, useState } from "react";
import { listarPlanteles } from "../../services/plantelesService.js";
import styles from "./BuscadorPlantelInline.module.css";

// Caché a nivel de módulo: una sola petición HTTP sin importar cuántas instancias existan
let _cache = null;
let _promesa = null;
function fetchPlanteles() {
  if (_cache) return Promise.resolve(_cache);
  if (!_promesa) _promesa = listarPlanteles().then(d => (_cache = d));
  return _promesa;
}

/**
 * Buscador inline de planteles.
 *
 * Props:
 *   excluirIds   number[]              IDs a ocultar de los resultados (ya seleccionados)
 *   onSeleccionar ({id, nombre}) => void  Callback al elegir un plantel
 *   placeholder  string                Texto del input (opcional)
 *   maxResultados number               Límite de filas visibles (default 6)
 *   autoFocus    bool                  (default true)
 */
export default function BuscadorPlantelInline({
  excluirIds = [],
  onSeleccionar,
  placeholder = "Buscar por nombre o número…",
  maxResultados = 6,
  autoFocus = true,
}) {
  const [query, setQuery] = useState("");
  const [planteles, setPlanteles] = useState(_cache ?? []);
  const [cargando, setCargando] = useState(!_cache);

  useEffect(() => {
    if (_cache) return;
    let vigente = true;
    fetchPlanteles()
      .then(data => { if (vigente) setPlanteles(data); })
      .catch(() => {})
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, []);

  const excluirSet = new Set(excluirIds);
  const q = query.trim().toLowerCase();

  // Si el término es numérico, ordena poniendo el número exacto primero y luego ascendente
  const sortPorNumero = (a, b) => {
    if (!/^\d+$/.test(q)) return a.nombre.localeCompare(b.nombre);
    const nA = (a.nombre.match(/\d+/) ?? ['0'])[0];
    const nB = (b.nombre.match(/\d+/) ?? ['0'])[0];
    if ((nA === q) !== (nB === q)) return nA === q ? -1 : 1;
    return parseInt(nA) - parseInt(nB);
  };

  const resultados = q.length > 0
    ? planteles
        .filter(p =>
          !excluirSet.has(p.id) && p.nombre.toLowerCase().includes(q)
        )
        .sort(sortPorNumero)
        .slice(0, maxResultados)
    : [];

  const handleSeleccionar = (p) => {
    onSeleccionar(p);
    setQuery("");
  };

  return (
    <div className={styles["buscador"]}>
      <input
        autoFocus={autoFocus}
        type="text"
        className={styles["buscador__input"]}
        placeholder={placeholder}
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      {q.length > 0 && (
        <div className={styles["buscador__resultados"]}>
          {cargando ? (
            <p className={styles["buscador__estado"]}>Cargando…</p>
          ) : resultados.length > 0 ? (
            resultados.map(p => (
              <button
                key={p.id}
                type="button"
                className={styles["buscador__item"]}
                onClick={() => handleSeleccionar(p)}
              >
                {p.nombre}
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
