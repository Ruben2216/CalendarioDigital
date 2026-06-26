import { useState } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./NotificacionFila.module.css";

// Fila de notificación expandible (estilo chat)
export default function NotificacionFila({ notif, onMarcarLeida }) {
  const [abierto, setAbierto] = useState(false);
  const { icono: Icono, color, titulo, mensaje, tiempo, lugar, sinLeer } = notif;

  const alternar = () => {
    setAbierto((v) => !v);
    if (sinLeer) onMarcarLeida?.(notif.id);
  };

  return (
    <div className={`${styles["fila"]} ${sinLeer ? styles["fila--sin-leer"] : ""}`}>
      <button type="button" className={styles["fila__cab"]} onClick={alternar} aria-expanded={abierto}>
        <span className={`${styles["fila__icono"]} ${styles[`fila__icono--${color}`]}`}>
          <Icono size={15} />
        </span>
        <span className={styles["fila__copia"]}>
          <span className={styles["fila__titulo"]}>{titulo}</span>
          <span className={styles["fila__subtitulo"]}>{tiempo} · {lugar}</span>
        </span>
        <ChevronDown
          size={15}
          className={`${styles["fila__chevron"]} ${abierto ? styles["fila__chevron--abierto"] : ""}`}
        />
      </button>

      {abierto && (
        <div className={styles["fila__detalle"]}>
          {mensaje || "Sin detalles adicionales."}
        </div>
      )}
    </div>
  );
}
