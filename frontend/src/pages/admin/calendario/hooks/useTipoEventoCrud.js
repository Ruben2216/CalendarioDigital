import { useState } from "react";
import { crearTipo, actualizarTipo, eliminarTipo } from "../../../../services/eventosService.js";
import { avisoError, confirmarEliminacion } from "../../../../lib/alertas.js";

function randomColor() {
  return "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0").toUpperCase();
}

/* Gestión de tipos de evento (simbología): alta, edición en línea y borrado.
   Recibe setTipos porque la lista vive junto a los eventos del calendario. */
export function useTipoEventoCrud({ setTipos, esAdmin, plantelPorDefectoId }) {
  const [tipoEditandoId, setTipoEditandoId] = useState(null);
  const [editNombre, setEditNombre] = useState("");
  const [editColor, setEditColor] = useState("#64748B");
  const [formTipoVisible, setFormTipoVisible] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoColor, setNuevoColor] = useState(randomColor);
  const [nuevoPlantelId, setNuevoPlantelId] = useState("");
  const [guardandoTipo, setGuardandoTipo] = useState(false);

  const iniciarEdicionTipo = (t) => {
    setTipoEditandoId(t.id);
    setEditNombre(t.etiqueta);
    setEditColor(t.color);
    setFormTipoVisible(false);
  };

  const guardarEdicionTipo = async (id) => {
    try {
      const actualizado = await actualizarTipo(id, { nombre: editNombre.trim(), color_hex: editColor });
      setTipos((prev) => prev.map((t) => t.id === id
        ? { ...t, etiqueta: actualizado.etiqueta, color: actualizado.color }
        : t
      ));
      setTipoEditandoId(null);
    } catch (err) {
      avisoError(err.message || "No se pudo actualizar el tipo.");
    }
  };

  const pedirEliminarTipo = async (t) => {
    const { isConfirmed } = await confirmarEliminacion(t.etiqueta);
    if (!isConfirmed) return;
    try {
      await eliminarTipo(t.id);
      setTipos((prev) => prev.filter((x) => x.id !== t.id));
    } catch (err) {
      avisoError(err.message || "No se pudo eliminar el tipo.");
    }
  };

  const guardarNuevoTipo = async () => {
    if (!nuevoNombre.trim() || guardandoTipo) return;
    setGuardandoTipo(true);
    try {
      const plantel_id = esAdmin
        ? (nuevoPlantelId || (plantelPorDefectoId ?? null))
        : undefined;
      const nuevo = await crearTipo({ nombre: nuevoNombre.trim(), color_hex: nuevoColor, plantel_id });
      setTipos((prev) => [...prev, nuevo]);
      setNuevoNombre("");
      setNuevoColor(randomColor());
      setNuevoPlantelId("");
      setFormTipoVisible(false);
    } catch (err) {
      avisoError(err.message || "No se pudo crear el tipo.");
    } finally {
      setGuardandoTipo(false);
    }
  };

  return {
    tipoEditandoId, setTipoEditandoId,
    editNombre, setEditNombre,
    editColor, setEditColor,
    formTipoVisible, setFormTipoVisible,
    nuevoNombre, setNuevoNombre,
    nuevoColor, setNuevoColor,
    nuevoPlantelId, setNuevoPlantelId,
    guardandoTipo,
    iniciarEdicionTipo, guardarEdicionTipo, pedirEliminarTipo, guardarNuevoTipo,
  };
}
