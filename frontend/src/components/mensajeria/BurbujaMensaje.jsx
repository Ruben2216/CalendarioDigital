import TarjetaSolicitud from './TarjetaSolicitud.jsx';
import styles from './BurbujaMensaje.module.css';

export default function BurbujaMensaje({
  mensaje,
  inicialesUsuario,
  esAdmin = false,
  onAprobar = null,
  onRechazar = null,
  resuelta = false,
}) {
  const esEnviado = mensaje.tipo === 'enviado';
  const esSolicitudEspacio = mensaje.solicitud?.tipo === 'solicitud_espacio';
  const puedeResolver = esAdmin && !esEnviado && esSolicitudEspacio && !resuelta;
  const mostrarTexto = !esSolicitudEspacio && Boolean(mensaje.texto);

  return (
    <div className={`${styles['burbuja']} ${styles[`burbuja--${mensaje.tipo}`]}`}>
      <span className={styles['burbuja__avatar']}>{esEnviado ? inicialesUsuario : ''}</span>
      <div className={styles['burbuja__contenido']}>
        {mensaje.solicitud && (
          <TarjetaSolicitud solicitud={mensaje.solicitud} tipo={mensaje.tipo} />
        )}
        {mostrarTexto && <p className={styles['burbuja__texto']}>{mensaje.texto}</p>}
        <span className={styles['burbuja__hora']}>{mensaje.hora}</span>
        {puedeResolver && (
          <div className={styles['burbuja__acciones']}>
            {typeof onAprobar === 'function' && (
              <button
                type="button"
                className={styles['burbuja__aprobar']}
                onClick={() => onAprobar(mensaje)}
              >
                Aprobar solicitud
              </button>
            )}
            {typeof onRechazar === 'function' && (
              <button
                type="button"
                className={styles['burbuja__rechazar']}
                onClick={() => onRechazar(mensaje)}
              >
                Rechazar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
