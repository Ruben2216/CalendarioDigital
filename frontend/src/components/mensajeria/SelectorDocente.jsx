import { useEffect, useState } from 'react';
import Modal from '../modal/Modal.jsx';
import styles from './SelectorDocente.module.css';

const BACKEND =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : (import.meta.env.VITE_BACKEND_URL ?? '');

function iniciales(nombre) {
  return (nombre || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export default function SelectorDocente({ abierto, onCerrar, onSeleccionar, idPlantel, idUsuario, esSuperadmin, rol, titulo = 'Contactar personal' }) {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!abierto) return;
    setCargando(true);
    setError(null);

    let url;
    if (idUsuario) {
      // Docente contactando admin: endpoint dedicado que filtra por plantel+turno del docente
      url = `${BACKEND}/api/mensajeria/admins/?id_usuario=${idUsuario}`;
    } else {
      const base = `${BACKEND}/api/usuarios/?excluir=superusuario,alumno${rol ? `&rol=${rol}` : ''}`;
      url = esSuperadmin ? base : `${base}&plantel=${idPlantel}`;
    }

    fetch(url, { headers: { 'Accept': 'application/json' } })
      .then((r) => r.json())
      .then((data) => setUsuarios(Array.isArray(data) ? data : data.usuarios ?? []))
      .catch(() => setError('No se pudieron cargar los usuarios.'))
      .finally(() => setCargando(false));
  }, [abierto, idPlantel, idUsuario, esSuperadmin, rol]);

  return (
    <Modal
      abierto={abierto}
      titulo={titulo}
      onCerrar={onCerrar}
      pie={
        <button type="button" className="boton boton--fantasma" onClick={onCerrar}>
          Cancelar
        </button>
      }
    >
      {cargando ? (
        <p className={styles['selector__vacio']}>Cargando…</p>
      ) : error ? (
        <p className={styles['selector__vacio']}>{error}</p>
      ) : usuarios.length === 0 ? (
        <p className={styles['selector__vacio']}>No hay usuarios disponibles en este plantel.</p>
      ) : (
        <ul className={styles['selector__lista']}>
          {usuarios.map((u) => {
            const subtitulo = u.plantel || u.planteles?.[0]?.plantel || '';
            return (
              <li key={u.id}>
                <button
                  type="button"
                  className={styles['selector__item']}
                  onClick={() => onSeleccionar(u.id)}
                >
                  <span className={styles['selector__avatar']}>{iniciales(u.nombre)}</span>
                  <div className={styles['selector__info']}>
                    <span className={styles['selector__nombre']}>{u.nombre}</span>
                    {subtitulo && (
                      <span className={styles['selector__turno']}>{subtitulo}</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
