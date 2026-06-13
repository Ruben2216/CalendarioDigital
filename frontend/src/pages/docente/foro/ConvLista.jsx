import styles from './ConvLista.module.css';

export default function ConvLista({ conversaciones, idActiva, onSeleccionar }) {
  return (
    <aside className={styles['conv-lista']}>
      <div className={styles['conv-lista__cabecera']}>
        <h2 className={styles['conv-lista__titulo']}>Mensajes</h2>
      </div>
      <ul className={styles['conv-lista__lista']}>
        {conversaciones.map((conv) => {
          const ultimo = conv.mensajes[conv.mensajes.length - 1];
          return (
            <li
              key={conv.id}
              className={`${styles['conv-item']} ${conv.id === idActiva ? styles['conv-item--activa'] : ''}`}
              onClick={() => onSeleccionar(conv.id)}
            >
              <span className={`${styles['conv-item__avatar']} ${styles[`conv-item__avatar--${conv.colorAvatar}`]}`}>
                {conv.iniciales}
              </span>
              <div className={styles['conv-item__info']}>
                <div className={styles['conv-item__fila']}>
                  <span className={styles['conv-item__nombre']}>{conv.destinatario}</span>
                  <span className={styles['conv-item__hora']}>{ultimo?.hora ?? ''}</span>
                </div>
                <div className={styles['conv-item__preview']}>{ultimo?.texto ?? ''}</div>
              </div>
              {conv.sinLeer > 0 && (
                <span className={styles['conv-item__badge']}>{conv.sinLeer}</span>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
