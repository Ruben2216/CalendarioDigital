import { useState } from 'react';
import Modal from '../../../components/modal/Modal.jsx';
import styles from './ModalSolicitud.module.css';

const GRUPOS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const HORARIOS = [
  '07:00 – 09:00 hrs', '09:00 – 11:00 hrs', '10:00 – 12:00 hrs',
  '11:00 – 13:00 hrs', '13:00 – 15:00 hrs', '15:00 – 17:00 hrs',
  '17:00 – 19:00 hrs', '19:00 – 21:00 hrs',
];
const RECURSOS = ['Cañón', 'Micrófono', 'Audiovisual', 'Cancha', 'Laboratorio', 'Sala de cómputo'];

const FORM_VACIO = {
  actividad: '', grupo: '', materia: '', fecha: '', horario: '',
  recursos: [], observaciones: '',
};

export default function ModalSolicitud({ abierto, onCerrar, onEnviar }) {
  const [form, setForm] = useState(FORM_VACIO);

  const cambiar = (campo) => (e) => setForm((p) => ({ ...p, [campo]: e.target.value }));

  const alternarRecurso = (recurso) => {
    setForm((p) => {
      const nuevo = p.recursos.includes(recurso)
        ? p.recursos.filter((r) => r !== recurso)
        : [...p.recursos, recurso];
      return { ...p, recursos: nuevo };
    });
  };

  const enviar = (e) => {
    e.preventDefault();
    onEnviar(form);
    setForm(FORM_VACIO);
  };

  return (
    <Modal
      abierto={abierto}
      titulo="Nueva solicitud formal"
      onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="boton boton--fantasma" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" form="form-solicitud" className="boton boton--primario">
            Enviar solicitud
          </button>
        </>
      }
    >
      <form id="form-solicitud" className="formulario" onSubmit={enviar}>
        <label className="formulario__campo">
          <span className="formulario__etiqueta">Nombre de la actividad</span>
          <input
            type="text"
            required
            placeholder="Ej. Exposición de química"
            value={form.actividad}
            onChange={cambiar('actividad')}
          />
        </label>

        <div className="formulario__fila">
          <label className="formulario__campo">
            <span className="formulario__etiqueta">Grupo</span>
            <select required value={form.grupo} onChange={cambiar('grupo')}>
              <option value="">Selecciona...</option>
              {GRUPOS.map((g) => (
                <option key={g} value={`3-${g}`}>3-{g}</option>
              ))}
            </select>
          </label>
          <label className="formulario__campo">
            <span className="formulario__etiqueta">Materia</span>
            <input
              type="text"
              required
              placeholder="Ej. Química II"
              value={form.materia}
              onChange={cambiar('materia')}
            />
          </label>
        </div>

        <div className="formulario__fila">
          <label className="formulario__campo">
            <span className="formulario__etiqueta">Fecha</span>
            <input type="date" required value={form.fecha} onChange={cambiar('fecha')} />
          </label>
          <label className="formulario__campo">
            <span className="formulario__etiqueta">Horario</span>
            <select required value={form.horario} onChange={cambiar('horario')}>
              <option value="">Selecciona...</option>
              {HORARIOS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="formulario__campo">
          <span className="formulario__etiqueta">Recursos</span>
          <div className={styles['recursos']}>
            {RECURSOS.map((r) => (
              <button
                key={r}
                type="button"
                className={`${styles['recursos__item']} ${form.recursos.includes(r) ? styles['recursos__item--activo'] : ''}`}
                onClick={() => alternarRecurso(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <label className="formulario__campo">
          <span className="formulario__etiqueta">Observaciones</span>
          <textarea
            placeholder="Comentarios adicionales..."
            value={form.observaciones}
            onChange={cambiar('observaciones')}
            rows={3}
          />
        </label>
      </form>
    </Modal>
  );
}
