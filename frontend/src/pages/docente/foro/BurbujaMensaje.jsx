import TarjetaSolicitud from './TarjetaSolicitud.jsx';
import styles from './BurbujaMensaje.module.css';

export default function BurbujaMensaje({ mensaje, inicialesUsuario }) {
  const esEnviado = mensaje.tipo === 'enviado';
  return (
    <div className={`${styles['burbuja']} ${styles[`burbuja--${mensaje.tipo}`]}`}>
      <span className={styles['burbuja__avatar']}>{esEnviado ? inicialesUsuario : ''}</span>
      <div className={styles['burbuja__contenido']}>
        {mensaje.solicitud && (
          <TarjetaSolicitud solicitud={mensaje.solicitud} tipo={mensaje.tipo} />
        )}
        <p className={styles['burbuja__texto']}>{mensaje.texto}</p>
        <span className={styles['burbuja__hora']}>{mensaje.hora}</span>
      </div>
    </div>
  );
}
