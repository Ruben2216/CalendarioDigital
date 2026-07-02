import SelectorFecha from '../campos/SelectorFecha.jsx';
import SelectorHora from '../campos/SelectorHora.jsx';
import SelectorPlantel from '../selector-plantel/SelectorPlantel.jsx';
import MensajeError from '../mensaje-error/MensajeError.jsx';
import { AREAS, SEMESTRES, GRUPOS, TURNOS } from '../../data/calendario.js';
import styles from './FormularioEvento.module.css';

export default function FormularioEvento({
  id = 'form-evento',
  form,
  tipos = [],
  restringido = false,
  planteles = [],
  turnos = [],
  error = null,
  minFecha = '',
  onChange,
  onSubmit,
}) {
  const set = (campo) => (e) => onChange(campo, e.target.value);
  const fij = (campo, valor) => onChange(campo, valor);
  const turnosVisibles = restringido && turnos.length ? turnos : TURNOS;

  const errorDe = (campo) =>
    error?.campo === campo ? <MensajeError>{error.mensaje}</MensajeError> : null;

  const esGeneral = !restringido && !form.plantel;

  const cambiarPlantel = (valor) => {
    fij('plantel', valor);
    if (!valor) {
      fij('especifico', false);
      fij('semestre', '');
      fij('grupo', '');
    }
  };

  return (
    <form id={id} className="formulario" onSubmit={onSubmit}>

      <label className="formulario__campo">
        <span className="formulario__etiqueta">Título <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opcional)</span></span>
        <input
          type="text"
          placeholder={tipos.find((t) => String(t.id) === String(form.tipo))?.etiqueta || 'Nombre del evento'}
          value={form.titulo}
          onChange={set('titulo')}
        />
      </label>

      <div className="formulario__fila">
        <label className="formulario__campo">
          <span className="formulario__etiqueta">Tipo de evento</span>
          <select value={form.tipo} onChange={set('tipo')}>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>{t.etiqueta}</option>
            ))}
          </select>
        </label>
        <label className="formulario__campo">
          <span className="formulario__etiqueta">Área (opcional)</span>
          <select value={form.area} onChange={set('area')}>
            <option value="">—</option>
            {AREAS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="formulario__fila">
        <div className="formulario__campo">
          <span className="formulario__etiqueta">Fecha inicio</span>
          <SelectorFecha
            value={form.fecha}
            min={minFecha}
            onChange={(v) => fij('fecha', v)}
          />
        </div>
        <div className="formulario__campo">
          <span className={`formulario__etiqueta ${styles['etiqueta-fin']}`}>
            Fecha fin (opcional)
            {form.fechaFin && (
              <button
                type="button"
                className={styles['limpiar-fecha']}
                onClick={() => fij('fechaFin', '')}
              >
                Limpiar
              </button>
            )}
          </span>
          <SelectorFecha
            value={form.fechaFin}
            min={form.fecha}
            placeholder="Mismo día"
            onChange={(v) => fij('fechaFin', v)}
          />
        </div>
      </div>

      {errorDe('fecha')}

      <div className={styles['interruptor']}>
        <div>
          <span className="formulario__etiqueta">Todo el día</span>
          <p className={styles['interruptor__nota']}>Sin hora de inicio ni fin.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.todoElDia}
          className={`${styles['switch']} ${form.todoElDia ? styles['switch--on'] : ''}`}
          onClick={() => fij('todoElDia', !form.todoElDia)}
        >
          <span className={styles['switch__bolita']} />
        </button>
      </div>

      {!form.todoElDia && (
        <div className="formulario__fila">
          <div className="formulario__campo">
            <span className="formulario__etiqueta">Hora inicio</span>
            <SelectorHora
              value={form.horaInicio}
              onChange={(v) => fij('horaInicio', v)}
            />
          </div>
          <div className="formulario__campo">
            <span className="formulario__etiqueta">Hora fin</span>
            <SelectorHora
              value={form.horaFin}
              onChange={(v) => fij('horaFin', v)}
            />
          </div>
        </div>
      )}

      {errorDe('hora')}

      <div className="formulario__fila">
        <label className="formulario__campo">
          <span className="formulario__etiqueta">Plantel</span>
          {restringido ? (
            <select value={form.plantel} onChange={set('plantel')} required>
              {planteles.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          ) : (
            <SelectorPlantel
              value={form.plantel}
              onChange={cambiarPlantel}
              textoTodos="Todos"
            />
          )}
        </label>
        <label className="formulario__campo">
          <span className="formulario__etiqueta">Turno</span>
          <select value={form.turno} onChange={set('turno')}>
            {!restringido && <option value="">Todos</option>}
            {turnosVisibles.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="formulario__campo">
        <span className="formulario__etiqueta">Lugar</span>
        <input
          type="text"
          placeholder="Aula, auditorio, explanada..."
          value={form.lugar}
          onChange={set('lugar')}
        />
      </label>

      <div className={styles['interruptor']}>
        <div>
          <span className="formulario__etiqueta">Agregar al calendario público</span>
          <p className={styles['interruptor__nota']}>
            Los invitados podrán ver este evento en el calendario público.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.publico}
          className={`${styles['switch']} ${form.publico ? styles['switch--on'] : ''}`}
          onClick={() => fij('publico', !form.publico)}
        >
          <span className={styles['switch__bolita']} />
        </button>
      </div>

      <div className={styles['interruptor']}>
        <div>
          <span className="formulario__etiqueta">Dirigido a un grupo/semestre específico</span>
          <p className={styles['interruptor__nota']}>
            {esGeneral
              ? 'No disponible para eventos de "Todos los planteles".'
              : 'Si está apagado, el evento aplica a todos.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.especifico && !esGeneral}
          disabled={esGeneral}
          className={`${styles['switch']} ${form.especifico && !esGeneral ? styles['switch--on'] : ''}`}
          style={esGeneral ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
          onClick={() => { if (!esGeneral) fij('especifico', !form.especifico); }}
        >
          <span className={styles['switch__bolita']} />
        </button>
      </div>

      {form.especifico && !esGeneral && (
        <div className="formulario__fila">
          <label className="formulario__campo">
            <span className="formulario__etiqueta">Semestre</span>
            <select value={form.semestre} onChange={set('semestre')}>
              <option value="">Todos</option>
              {SEMESTRES.map((s) => (
                <option key={s} value={s}>{s}.º</option>
              ))}
            </select>
          </label>
          <label className="formulario__campo">
            <span className="formulario__etiqueta">Grupo</span>
            <select value={form.grupo} onChange={set('grupo')}>
              <option value="">Todos</option>
              {GRUPOS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
        </div>
      )}

    </form>
  );
}
