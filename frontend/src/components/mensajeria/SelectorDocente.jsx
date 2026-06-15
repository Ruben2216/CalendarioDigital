import { useEffect, useState } from 'react';
import Modal from '../modal/Modal.jsx';
import styles from './SelectorDocente.module.css';

const BACKEND =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000');

function iniciales(nombre) {
  return (nombre || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export default function SelectorDocente({ abierto, onCerrar, onSeleccionar, idPlantel, esSuperadmin }) {
  const [docentes, setDocentes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!abierto) return;
    setCargando(true);
    setError(null);

    const url = esSuperadmin
      ? `${BACKEND}/api/usuarios/?rol=docente`
      : `${BACKEND}/api/usuarios/?rol=docente&plantel=${idPlantel}`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => setDocentes(Array.isArray(data) ? data : data.usuarios ?? []))
      .catch(() => setError('No se pudieron cargar los docentes.'))
      .finally(() => setCargando(false));
  }, [abierto, idPlantel, esSuperadmin]);

  return (
    <Modal
      abierto={abierto}
      titulo="Contactar docente"
      onCerrar={onCerrar}
      pie={
        <button type="button" className="boton boton--fantasma" onClick={onCerrar}>
          Cancelar
        </button>
      }
    >
      {cargando ? (
        <p className={styles['selector__vacio']}>Cargando docentes…</p>
      ) : error ? (
        <p className={styles['selector__vacio']}>{error}</p>
      ) : docentes.length === 0 ? (
        <p className={styles['selector__vacio']}>No hay docentes disponibles en este plantel.</p>
      ) : (
        <ul className={styles['selector__lista']}>
          {docentes.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                className={styles['selector__item']}
                onClick={() => onSeleccionar(d.id)}
              >
                <span className={styles['selector__avatar']}>{iniciales(d.nombre)}</span>
                <div className={styles['selector__info']}>
                  <span className={styles['selector__nombre']}>{d.nombre}</span>
                  {d.plantel && (
                    <span className={styles['selector__turno']}>{d.plantel}</span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
