import SelectorFecha from '../campos/SelectorFecha.jsx';
import SelectorHora from '../campos/SelectorHora.jsx';
import SelectorPlantel from '../selector-plantel/SelectorPlantel.jsx';
import { AREAS, TIPOS, SEMESTRES, GRUPOS, TURNOS } from '../../data/calendario.js';
import styles from './FormularioEvento.module.css';

export default function FormularioEvento({
  id = 'form-evento',
  form,
  tipos = TIPOS,
  onChange,
  onSubmit,
}) {
  const set = (campo) => (e) => onChange(campo, e.target.value);
  const fij = (campo, valor) => onChange(campo, valor);

  return (
    <form id={id} className="formulario" onSubmit={onSubmit}>

      <label className="formulario__campo">
        <span className="formulario__etiqueta">Título</span>
        <input
          type="text"
          required
          placeholder="Nombre del evento"
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
          <span className="formulario__etiqueta">Área</span>
          <select value={form.area} onChange={set('area')}>
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
            onChange={(v) => fij('fecha', v)}
          />
        </div>
        <div className="formulario__campo">
          <span className="formulario__etiqueta">Fecha fin (opcional)</span>
          <SelectorFecha
            value={form.fechaFin}
            min={form.fecha}
            placeholder="Mismo día"
            onChange={(v) => fij('fechaFin', v)}
          />
        </div>
      </div>

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

      <div className="formulario__fila">
        <label className="formulario__campo">
          <span className="formulario__etiqueta">Plantel</span>
          <SelectorPlantel
            value={form.plantel}
            onChange={(v) => fij('plantel', v)}
            textoTodos="Todos"
          />
        </label>
        <label className="formulario__campo">
          <span className="formulario__etiqueta">Turno</span>
          <select value={form.turno} onChange={set('turno')}>
            <option value="">Todos</option>
            {TURNOS.map((t) => (
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
          <span className="formulario__etiqueta">Dirigido a un grupo/semestre específico</span>
          <p className={styles['interruptor__nota']}>Si está apagado, el evento aplica a todos.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.especifico}
          className={`${styles['switch']} ${form.especifico ? styles['switch--on'] : ''}`}
          onClick={() => fij('especifico', !form.especifico)}
        >
          <span className={styles['switch__bolita']} />
        </button>
      </div>

      {form.especifico && (
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
