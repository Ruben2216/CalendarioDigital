import styles from './ConvLista.module.css';

export default function ConvLista({
  conversaciones,
  idActiva,
  onSeleccionar,
  titulo = 'Mensajes',
  cargando = false,
  error = false,
  onReintentar = null,
}) {
  return (
    <aside className={styles['conv-lista']}>
      <div className={styles['conv-lista__cabecera']}>
        <h2 className={styles['conv-lista__titulo']}>{titulo}</h2>
      </div>

      {error ? (
        <div className={styles['conv-lista__aviso']}>
          <p>No se pudieron cargar las conversaciones.</p>
          {onReintentar && (
            <button
              type="button"
              className="boton boton--fantasma"
              style={{ marginTop: 10 }}
              onClick={onReintentar}
            >
              Reintentar
            </button>
          )}
        </div>
      ) : cargando ? (
        <p className={styles['conv-lista__aviso']}>Cargando conversaciones…</p>
      ) : conversaciones.length === 0 ? (
        <p className={styles['conv-lista__aviso']}>No hay conversaciones.</p>
      ) : (
      <ul className={styles['conv-lista__lista']}>
        {conversaciones.map((conv) => {
          const ultimo = conv.mensajes[conv.mensajes.length - 1];
          const sinLeer = conv.sin_leer ?? conv.sinLeer ?? 0;
          return (
            <li
              key={conv.id}
              className={`${styles['conv-item']} ${conv.id === idActiva ? styles['conv-item--activa'] : ''} ${sinLeer > 0 ? styles['conv-item--no-leida'] : ''}`}
              onClick={() => onSeleccionar(conv.id)}
            >
              <span className={`${styles['conv-item__avatar']} ${styles[`conv-item__avatar--${conv.colorAvatar}`]}`}>
                {conv.iniciales}
              </span>
                <div className={styles['conv-item__info']}>
                  <div className={styles['conv-item__fila']}>
                    <div className={styles['conv-item__nombre-col']}>
                      <span className={styles['conv-item__nombre']}>{conv.destinatario}</span>
                      <span className={styles['conv-item__ubicacion']}>{conv.ubicacion || ''}</span>
                    </div>
                    <span className={styles['conv-item__hora']}>{ultimo?.hora ?? ''}</span>
                  </div>
                  <div className={styles['conv-item__preview']}>{ultimo?.texto ?? ''}</div>
                </div>
              {sinLeer > 0 && (
                <span className={styles['conv-item__badge']}>{sinLeer}</span>
              )}
            </li>
          );
        })}
      </ul>
      )}
    </aside>
  );
}
