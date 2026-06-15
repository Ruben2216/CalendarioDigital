import { useState } from 'react';
import Modal from '../../../components/modal/Modal.jsx';
import FormularioEvento from '../../../components/formulario-evento/FormularioEvento.jsx';
import { TIPOS } from '../../../data/calendario.js';
import styles from './ModalSolicitud.module.css';

const RECURSOS = ['Cañón', 'Micrófono', 'Audiovisual', 'Cancha', 'Laboratorio', 'Sala de cómputo'];

const FORM_VACIO = {
  titulo: '',
  tipo: 'academico',
  area: 'Académica',
  fecha: '',
  fechaFin: '',
  horaInicio: '',
  horaFin: '',
  lugar: '',
  formato: 'punto',
  todoElDia: false,
  recursos: [],
  observaciones: '',
};

export default function ModalSolicitud({ abierto, onCerrar, onEnviar, plantel }) {
  const [form, setForm] = useState(FORM_VACIO);

  const handleChange = (campo, valor) =>
    setForm((prev) => ({ ...prev, [campo]: valor }));

  const alternarRecurso = (recurso) =>
    setForm((prev) => ({
      ...prev,
      recursos: prev.recursos.includes(recurso)
        ? prev.recursos.filter((r) => r !== recurso)
        : [...prev.recursos, recurso],
    }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.fecha || !form.titulo.trim()) return;

    onEnviar({
      titulo:        form.titulo.trim(),
      tipo:          form.tipo,
      area:          form.area,
      fecha:         form.fecha,
      fechaFin:      form.fechaFin || null,
      horaInicio:    form.todoElDia ? '' : form.horaInicio,
      horaFin:       form.todoElDia ? '' : form.horaFin,
      lugar:         form.lugar.trim(),
      recursos:      form.recursos,
      observaciones: form.observaciones.trim(),
      plantel:       plantel?.nombre ?? '',
    });

    setForm(FORM_VACIO);
  };

  return (
    <Modal
      abierto={abierto}
      titulo="Nueva solicitud de espacio o evento"
      onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="boton boton--fantasma" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" form="form-solicitud-docente" className="boton boton--primario">
            Enviar solicitud
          </button>
        </>
      }
    >
      <FormularioEvento
        id="form-solicitud-docente"
        form={form}
        tipos={TIPOS}
        onChange={handleChange}
        onSubmit={handleSubmit}
      />

      <div className="formulario__campo" style={{ marginTop: 12 }}>
        <span className="formulario__etiqueta">Recursos necesarios</span>
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
        <span className="formulario__etiqueta">Observaciones adicionales</span>
        <textarea
          placeholder="Contexto adicional, detalles especiales..."
          value={form.observaciones}
          rows={3}
          onChange={(e) => handleChange('observaciones', e.target.value)}
        />
      </label>
    </Modal>
  );
}
