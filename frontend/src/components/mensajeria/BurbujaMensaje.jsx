import TarjetaSolicitud from './TarjetaSolicitud.jsx';
import styles from './BurbujaMensaje.module.css';

export default function BurbujaMensaje({ mensaje, inicialesUsuario, esAdmin = false, onAprobar = null }) {
  const esEnviado = mensaje.tipo === 'enviado';
  const puedeAprobar =
    esAdmin &&
    !esEnviado &&
    mensaje.solicitud?.tipo === 'solicitud_espacio' &&
    typeof onAprobar === 'function';

  return (
    <div className={`${styles['burbuja']} ${styles[`burbuja--${mensaje.tipo}`]}`}>
      <span className={styles['burbuja__avatar']}>{esEnviado ? inicialesUsuario : ''}</span>
      <div className={styles['burbuja__contenido']}>
        {mensaje.solicitud && (
          <TarjetaSolicitud solicitud={mensaje.solicitud} tipo={mensaje.tipo} />
        )}
        <p className={styles['burbuja__texto']}>{mensaje.texto}</p>
        <span className={styles['burbuja__hora']}>{mensaje.hora}</span>
        {puedeAprobar && (
          <button
            type="button"
            className={styles['burbuja__aprobar']}
            onClick={() => onAprobar(mensaje)}
          >
            Aprobar solicitud
          </button>
        )}
      </div>
    </div>
  );
}
