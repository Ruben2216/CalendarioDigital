import { Megaphone, MapPin, Pencil, Trash2 } from "lucide-react";
import { ABREV_MES } from "../../lib/fechas.js";
import { AUDIENCIAS } from "../../data/anuncios.js";
import styles from "./ListaAnuncios.module.css";

const AUDIENCIA_MAP = Object.fromEntries(AUDIENCIAS.map((a) => [a.id, a]));

function fechaCorta(iso) {
  if (!iso) return "";
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${ABREV_MES[m - 1]}`;
}

export default function ListaAnuncios({ anuncios, onEditar, onEliminar, mostrarAudiencia = false }) {
  if (!anuncios || anuncios.length === 0) {
    return <p className={styles["vacio"]}>No hay anuncios.</p>;
  }

  const conAcciones = Boolean(onEditar || onEliminar);

  return (
    <div className={styles["lista"]}>
      {anuncios.map((a) => {
        const aud = AUDIENCIA_MAP[a.audiencia];
        return (
          <div key={a.id} className={styles["anuncio"]}>
            <span className={`${styles["anuncio__icono"]} ${styles[`anuncio__icono--${a.color}`]}`}>
              <Megaphone size={14} />
            </span>

            <div className={styles["anuncio__copia"]}>
              <h3 className={styles["anuncio__titulo"]}>{a.titulo}</h3>
              <p className={styles["anuncio__desc"]}>{a.descripcion}</p>
              {mostrarAudiencia && (
                <div className={styles["anuncio__metas"]}>
                  {aud && (
                    <span className={`etiqueta etiqueta--${aud.color}`}>{aud.etiqueta}</span>
                  )}
                  <span className={styles["anuncio__alcance"]}>
                    <MapPin size={11} />
                    {a.plantel || "General"}
                  </span>
                </div>
              )}
            </div>

            {conAcciones ? (
              <div className={styles["anuncio__acciones"]}>
                {onEditar && (
                  <button type="button" onClick={() => onEditar(a)} aria-label="Editar" title="Editar">
                    <Pencil size={15} />
                  </button>
                )}
                {onEliminar && (
                  <button
                    type="button"
                    className={styles["anuncio__borrar"]}
                    onClick={() => onEliminar(a)}
                    aria-label="Eliminar"
                    title="Eliminar"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ) : (
              <span className={styles["anuncio__fecha"]}>{fechaCorta(a.fecha)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
