import { useState } from "react";
import { Megaphone, ChevronDown } from "lucide-react";
import { ABREV_MES } from "../../lib/fechas.js";
import { idsLeidos, marcarLeido } from "../../lib/anunciosLeidos.js";
import styles from "./ListaAnunciosLectura.module.css";

function fechaCorta(iso) {
  if (!iso) return "";
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${ABREV_MES[m - 1]}`;
}

export default function ListaAnunciosLectura({ anuncios }) {
  const [abierto, setAbierto] = useState(null);
  const [leidos, setLeidos] = useState(() => idsLeidos());

  if (!anuncios || anuncios.length === 0) {
    return <p className={styles["vacio"]}>No hay anuncios.</p>;
  }

  const alternar = (a) => {
    const nuevo = abierto === a.id ? null : a.id;
    setAbierto(nuevo);
    if (nuevo !== null && !leidos.has(a.id)) {
      marcarLeido(a.id);
      setLeidos((prev) => new Set(prev).add(a.id));
    }
  };

  return (
    <div className={styles["lista"]}>
      {anuncios.map((a) => {
        const expandido = abierto === a.id;
        const noLeido = !leidos.has(a.id);
        return (
          <div
            key={a.id}
            className={`${styles["anuncio"]} ${noLeido ? styles["anuncio--no-leido"] : ""}`}
          >
            <button
              type="button"
              className={styles["anuncio__cab"]}
              onClick={() => alternar(a)}
              aria-expanded={expandido}
            >
              <span className={`${styles["anuncio__icono"]} ${styles[`anuncio__icono--${a.color}`]}`}>
                <Megaphone size={14} />
              </span>
              <span className={styles["anuncio__titulo"]}>{a.titulo}</span>
              {noLeido && <span className={styles["anuncio__punto"]} title="No leído" />}
              <span className={styles["anuncio__fecha"]}>{fechaCorta(a.fecha)}</span>
              <ChevronDown
                size={16}
                className={`${styles["anuncio__flecha"]} ${expandido ? styles["anuncio__flecha--abierta"] : ""}`}
              />
            </button>
            {expandido && (
              <div className={styles["anuncio__cuerpo"]}>
                <p className={styles["anuncio__desc"]}>{a.descripcion}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
