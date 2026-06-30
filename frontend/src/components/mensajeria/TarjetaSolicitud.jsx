import { desdeClaveFecha } from '../../lib/fechas.js';
import styles from './TarjetaSolicitud.module.css';

const fechaMX = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit', month: '2-digit', year: 'numeric',
});

function formatearValor(valor) {
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return fechaMX.format(desdeClaveFecha(valor));
  }
  return valor;
}

const ICONOS = {
  calendario: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  check: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
};

export default function TarjetaSolicitud({ solicitud, tipo }) {
  const icono = ICONOS[solicitud.icono] ?? ICONOS.calendario;
  const claseEstado =
    solicitud.tipo === 'solicitud_aprobada' ? styles['tarjeta--aprobada']
    : solicitud.tipo === 'solicitud_rechazada' ? styles['tarjeta--rechazada']
    : '';
  return (
    <div className={`${styles['tarjeta']} ${styles[`tarjeta--${tipo}`]} ${claseEstado}`}>
      <div className={styles['tarjeta__cabecera']}>
        {icono}
        <span>{solicitud.titulo.toUpperCase()}</span>
      </div>
      <div className={styles['tarjeta__cuerpo']}>
        {solicitud.campos.map(({ clave, valor }) => (
          <div key={clave} className={styles['tarjeta__fila']}>
            <span className={styles['tarjeta__clave']}>{clave}</span>
            <span className={styles['tarjeta__valor']}>{formatearValor(valor)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
