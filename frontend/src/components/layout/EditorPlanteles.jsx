import { useState } from "react";
import { Pencil, X, Plus } from "lucide-react";
import { guardarConfiguracionPlanteles } from "../../services/authService.js";
import BuscadorPlantelInline from "../buscador-plantel/BuscadorPlantelInline.jsx";
import styles from "./Layout.module.css";

const TURNOS_FIJOS = ['Matutino', 'Vespertino', 'Mixto'];
const LIMITE_PLANTELES = 2;

// Sección "Planteles asignados" del panel de perfil del docente, con modo
// lectura y modo edición (agregar/quitar plantel, alternar turno, guardar).
// El estado de edición vive aquí: al cerrarse el panel de perfil el componente
// se desmonta y vuelve a iniciar en modo lectura.
export default function EditorPlanteles({ plantelesAgrupados }) {
  const [editando, setEditando] = useState(false);
  const [editState, setEditState] = useState([]); // [{ plantel:{id,nombre}, turnos: Set<string> }]
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorEdit, setErrorEdit] = useState('');

  const resetEdit = () => {
    setEditando(false); setEditState([]); setBuscando(false); setErrorEdit('');
  };

  const entrarEdit = () => {
    setEditState(plantelesAgrupados.map(({ plantel, turnos }) => ({
      plantel,
      turnos: new Set(turnos.map(t => t.nombre)),
    })));
    setErrorEdit('');
    setEditando(true);
  };

  const quitarPlantel = (id) =>
    setEditState(prev => prev.filter(e => e.plantel.id !== id));

  // Radio: seleccionar un turno deselecciona los demás (Matutino/Vespertino/Mixto son excluyentes)
  const toggleTurno = (plantelId, tn) =>
    setEditState(prev => prev.map(e =>
      e.plantel.id !== plantelId ? e : { ...e, turnos: new Set([tn]) }
    ));

  const agregarPlantel = (p) => {
    if (editState.some(e => e.plantel.id === p.id)) return;
    if (editState.length >= LIMITE_PLANTELES) {
      setErrorEdit(`Límite de ${LIMITE_PLANTELES} planteles. Elimina uno antes de agregar otro.`);
      setBuscando(false);
      return;
    }
    setEditState(prev => [...prev, { plantel: { id: p.id, nombre: p.nombre }, turnos: new Set(['Matutino']) }]);
    setBuscando(false);
  };

  const guardarCambios = async () => {
    if (editState.length === 0) { setErrorEdit('Agrega al menos un plantel.'); return; }
    setGuardando(true); setErrorEdit('');
    const selecciones = {};
    editState.forEach(({ plantel, turnos }) => {
      selecciones[plantel.id] = {
        matutino: turnos.has('Matutino'),
        vespertino: turnos.has('Vespertino'),
        mixto: turnos.has('Mixto'),
      };
    });
    const res = await guardarConfiguracionPlanteles(selecciones);
    setGuardando(false);
    if (!res.exito) { setErrorEdit(res.error || 'Error al guardar.'); return; }
    const sesionActual = JSON.parse(localStorage.getItem('sesion') || '{}');
    localStorage.setItem('sesion', JSON.stringify({ ...sesionActual, planteles: res.datos.planteles ?? [] }));
    resetEdit();
  };

  return (
    <div className={styles["menu-perfil__planteles"]}>
      {/* cabecera de sección */}
      <div className={styles["menu-perfil__planteles-header"]}>
        <span className={styles["menu-perfil__planteles-label"]}>Planteles asignados</span>
        {!editando
          ? <button type="button" className={styles["menu-perfil__edit-btn"]} onClick={entrarEdit}><Pencil size={11} />Editar</button>
          : <button type="button" className={styles["menu-perfil__edit-btn"]} onClick={resetEdit}>Cancelar</button>
        }
      </div>

      {/* modo lectura */}
      {!editando && (
        plantelesAgrupados.length > 0
          ? plantelesAgrupados.map(({ plantel, turnos }) => (
            <div key={plantel.id} className={styles["menu-perfil__plantel-fila"]}>
              <span className={styles["menu-perfil__plantel-nombre"]} title={plantel.nombre}>{plantel.nombre}</span>
              <span className={styles["menu-perfil__turnos-badges"]}>
                {turnos.map(t => {
                  const m = ['matutino','vespertino','mixto'].includes(t.nombre.toLowerCase()) ? t.nombre.toLowerCase() : 'otro';
                  return <span key={t.id} className={`${styles['menu-perfil__turno-badge']} ${styles[`menu-perfil__turno-badge--${m}`]}`}>{t.nombre}</span>;
                })}
              </span>
            </div>
          ))
          : <p className={styles["menu-perfil__sin-planteles"]}>Sin planteles configurados</p>
      )}

      {/* modo edición */}
      {editando && (
        <>
          {/* caso 1 y 3: quitar plantel o cambiar turno */}
          {editState.map(({ plantel, turnos }) => (
            <div key={plantel.id} className={`${styles["menu-perfil__plantel-fila"]} ${styles["menu-perfil__plantel-fila--edit"]}`}>
              <span className={styles["menu-perfil__plantel-nombre"]} title={plantel.nombre}>{plantel.nombre}</span>
              <span className={styles["menu-perfil__turnos-badges"]}>
                {TURNOS_FIJOS.map(tn => {
                  const activo = turnos.has(tn);
                  const cl = tn.toLowerCase();
                  return (
                    <button key={tn} type="button"
                      title={activo ? `Quitar ${tn}` : `Agregar ${tn}`}
                      className={`${styles['menu-perfil__turno-toggle']} ${activo ? styles[`menu-perfil__turno-toggle--${cl}`] : styles['menu-perfil__turno-toggle--off']}`}
                      onClick={() => toggleTurno(plantel.id, tn)}
                    >{tn[0]}</button>
                  );
                })}
              </span>
              <button type="button" className={styles["menu-perfil__remove-btn"]} title="Quitar plantel" onClick={() => quitarPlantel(plantel.id)}>
                <X size={12} />
              </button>
            </div>
          ))}

          {editState.length >= LIMITE_PLANTELES ? (
            <p className={styles["menu-perfil__limite-aviso"]}>
              Máximo {LIMITE_PLANTELES} planteles. Elimina uno para agregar otro.
            </p>
          ) : !buscando ? (
              <button type="button" className={styles["menu-perfil__agregar-btn"]} onClick={() => setBuscando(true)}>
                <Plus size={12} />Agregar plantel
              </button>
            ) : (
              <div className={styles["menu-perfil__buscar-wrap"]}>
                <BuscadorPlantelInline
                  excluirIds={editState.map(e => e.plantel.id)}
                  onSeleccionar={agregarPlantel}
                />
              </div>
            )
          }

          {/* guardar */}
          <div className={styles["menu-perfil__edit-footer"]}>
            {errorEdit && <span className={styles["menu-perfil__error-edit"]}>{errorEdit}</span>}
            <button type="button" className={styles["menu-perfil__save-btn"]}
              onClick={guardarCambios} disabled={guardando || editState.length === 0}>
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
