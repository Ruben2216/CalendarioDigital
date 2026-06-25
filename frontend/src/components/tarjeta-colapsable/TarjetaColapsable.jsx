import { ChevronDown } from "lucide-react";
import { usePreferencia } from "../../hooks/usePreferencia.js";
import styles from "./TarjetaColapsable.module.css";

// Tarjeta con encabezado clicable para mostrar/ocultar su contenido.
export default function TarjetaColapsable({
  id,
  icono: Icono,
  titulo,
  accion,
  defaultAbierto = true,
  children,
}) {
  const [abierto, setAbierto] = usePreferencia(id ? `tarjeta:${id}` : null, defaultAbierto);

  return (
    <article className="tarjeta">
      <div className="tarjeta__cabecera">
        <button
          type="button"
          className={styles["toggle"]}
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
        >
          <ChevronDown
            size={16}
            className={`${styles["chevron"]} ${abierto ? styles["chevron--abierto"] : ""}`}
          />
          <span className="tarjeta__titulo">
            {Icono && <Icono size={16} />}
            {titulo}
          </span>
        </button>
        {accion && <div className={styles["accion"]}>{accion}</div>}
      </div>

      {abierto && children}
    </article>
  );
}
