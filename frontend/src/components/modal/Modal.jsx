import { useEffect } from "react";
import { X } from "lucide-react";
import styles from "./Modal.module.css";

export default function Modal({ abierto, titulo, onCerrar, children, pie }) {
  useEffect(() => {
    if (!abierto) return;

    const manejarTecla = (e) => {
      if (e.key === "Escape") onCerrar();
    };

    document.addEventListener("keydown", manejarTecla);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", manejarTecla);
      document.body.style.overflow = "";
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div className={styles["modal"]} onMouseDown={onCerrar}>
      <div
        className={styles["modal__dialogo"]}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={styles["modal__cabecera"]}>
          <h3 className={styles["modal__titulo"]}>{titulo}</h3>
          <button
            type="button"
            className={styles["modal__cerrar"]}
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles["modal__cuerpo"]}>{children}</div>

        {pie && <div className={styles["modal__pie"]}>{pie}</div>}
      </div>
    </div>
  );
}
