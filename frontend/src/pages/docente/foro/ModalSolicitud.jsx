import { useEffect, useMemo, useState } from 'react';
import Modal from '../../../components/modal/Modal.jsx';
import FormularioEvento from '../../../components/formulario-evento/FormularioEvento.jsx';
import { listarTipos } from '../../../services/eventosService.js';
import { validarEvento } from '../../../lib/validaciones.js';
import { ahoraMexico, aClaveFecha } from '../../../lib/fechas.js';
import styles from './ModalSolicitud.module.css';

const RECURSOS = ['Cañón', 'Micrófono', 'Audiovisual', 'Cancha', 'Laboratorio', 'Sala de cómputo', 'Mesas',];

const FORM_VACIO = {
  titulo: '',
  tipo: '',
  area: '',
  fecha: '',
  fechaFin: '',
  horaInicio: '',
  horaFin: '',
  lugar: '',
  plantel: '',
  turno: '',
  formato: 'punto',
  todoElDia: false,
  especifico: false,
  semestre: '',
  grupo: '',
  recursos: [],
  observaciones: '',
};

function turnosDe(asignaciones, nombrePlantel) {
  return [...new Set(
    asignaciones
      .filter((a) => a.plantel?.nombre === nombrePlantel)
      .map((a) => a.turno?.nombre)
      .filter(Boolean),
  )];
}

export default function ModalSolicitud({ abierto, onCerrar, onEnviar, asignaciones = [] }) {
  const planteles = useMemo(
    () => [...new Set(asignaciones.map((a) => a.plantel?.nombre).filter(Boolean))],
    [asignaciones],
  );

  const [form, setForm] = useState(() => {
    const plantel = planteles[0] || '';
    return { ...FORM_VACIO, plantel, turno: turnosDe(asignaciones, plantel)[0] || '' };
  });
  const [tipos, setTipos] = useState([]);
  const [error, setError] = useState(null);

  const turnos = useMemo(() => turnosDe(asignaciones, form.plantel), [asignaciones, form.plantel]);

  useEffect(() => {
    listarTipos()
      .then((t) => {
        setTipos(t);
        setForm((prev) => (prev.tipo ? prev : { ...prev, tipo: t[0]?.id || '' }));
      })
      .catch(() => setTipos([]));
  }, []);

  const handleChange = (campo, valor) => {
    if (error) setError(null);
    if (campo === 'plantel') {
      const turnosP = turnosDe(asignaciones, valor);
      setForm((prev) => ({ ...prev, plantel: valor, turno: turnosP[0] || '' }));
      return;
    }
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const alternarRecurso = (recurso) =>
    setForm((prev) => ({
      ...prev,
      recursos: prev.recursos.includes(recurso)
        ? prev.recursos.filter((r) => r !== recurso)
        : [...prev.recursos, recurso],
    }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const tipoEtiqueta = tipos.find((t) => String(t.id) === String(form.tipo))?.etiqueta || '';
    const errorValidacion = validarEvento(form, { hoy: aClaveFecha(ahoraMexico()) });
    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }
    setError(null);

    onEnviar({
      titulo:        form.titulo.trim() || tipoEtiqueta,
      tipo:          form.tipo,
      tipoEtiqueta,
      area:          form.area,
      fecha:         form.fecha,
      fechaFin:      form.fechaFin || null,
      horaInicio:    form.todoElDia ? '' : form.horaInicio,
      horaFin:       form.todoElDia ? '' : form.horaFin,
      lugar:         form.lugar.trim(),
      recursos:      form.recursos,
      observaciones: form.observaciones.trim(),
      plantel:       form.plantel,
      turno:         form.turno,
      especifico:    form.especifico,
      semestre:      form.especifico ? form.semestre : '',
      grupo:         form.especifico ? form.grupo : '',
    });

    const primerPlantel = planteles[0] || '';
    setForm({
      ...FORM_VACIO,
      tipo: tipos[0]?.id || '',
      plantel: primerPlantel,
      turno: turnosDe(asignaciones, primerPlantel)[0] || '',
    });
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
        tipos={tipos}
        restringido
        planteles={planteles}
        turnos={turnos}
        error={error}
        minFecha={aClaveFecha(ahoraMexico())}
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
