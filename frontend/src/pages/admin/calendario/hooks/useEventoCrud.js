import { useRef, useState } from "react";
import { crearEvento, actualizarEvento, eliminarEvento } from "../../../../services/eventosService.js";
import { validarEvento } from "../../../../lib/validaciones.js";
import { avisoCreado, avisoEditado, avisoEliminado, avisoError, confirmarEliminacion } from "../../../../lib/alertas.js";
import { FORM_EVENTO_VACIO } from "../../../../data/formularios.js";

/* Modal de evento (alta/edición) y borrado con confirmación.
   valoresIniciales: campos por defecto del formulario nuevo (tipo, plantel, turno...).
   alGuardar(fecha): la vista selecciona el día y mueve FullCalendar.
   antesDeEliminar(): la vista cierra su popover antes de confirmar. */
export function useEventoCrud({
  calendarioActivo, claveHoy, eventos, cargarEventos,
  valoresIniciales, alGuardar, antesDeEliminar,
}) {
  const [modalEvento, setModalEvento] = useState(false);
  const [formEvento, setFormEvento] = useState(FORM_EVENTO_VACIO);
  const [eventoEditando, setEventoEditando] = useState(null);
  const [guardandoEvento, setGuardandoEvento] = useState(false);
  const [errorEvento, setErrorEvento] = useState(null);
  const guardandoRef = useRef(false);

  const abrirNuevoEventoEnFecha = (fecha, fechaFin = "") => {
    setEventoEditando(null);
    setErrorEvento(null);
    setFormEvento({
      ...FORM_EVENTO_VACIO,
      fecha,
      fechaFin: fechaFin && fechaFin !== fecha ? fechaFin : "",
      ...valoresIniciales(),
    });
    setModalEvento(true);
  };

  const abrirEditarEvento = (ev) => {
    setEventoEditando(ev.id);
    setErrorEvento(null);
    setFormEvento({
      titulo: ev.titulo, tipo: ev.tipo, area: ev.area || "", fecha: ev.fecha,
      fechaFin: ev.fechaFin || "", horaInicio: ev.horaInicio || "",
      horaFin: ev.horaFin || "", lugar: ev.lugar || "", plantel: ev.plantel ?? "",
      turno: ev.turno ?? "", formato: ev.formato || "punto",
      todoElDia: !ev.horaInicio,
      especifico: ev.semestre != null || ev.grupo != null,
      semestre: ev.semestre ?? "", grupo: ev.grupo ?? "",
      publico: ev.publico ?? false,
    });
    setModalEvento(true);
  };

  const guardarEvento = async (e) => {
    e.preventDefault();
    if (!calendarioActivo || guardandoRef.current) return;
    const errorValidacion = validarEvento(formEvento, { hoy: claveHoy });
    if (errorValidacion) {
      setErrorEvento(errorValidacion);
      return;
    }
    setErrorEvento(null);
    const { todoElDia, especifico, formato, agregarAGoogleCalendar, ...resto } = formEvento;
    const dirigidoEspecifico = especifico && Boolean(formEvento.plantel);
    const datos = {
      ...resto,
      id_calendario: calendarioActivo,
      titulo: formEvento.titulo.trim(),
      lugar: formEvento.lugar.trim(),
      area: formEvento.area || "",
      fechaFin: formEvento.fechaFin || null,
      horaInicio: todoElDia ? "" : formEvento.horaInicio,
      horaFin: todoElDia ? "" : formEvento.horaFin,
      plantel: formEvento.plantel || null,
      turno: formEvento.turno || null,
      semestre: dirigidoEspecifico && formEvento.semestre ? Number(formEvento.semestre) : null,
      grupo: dirigidoEspecifico && formEvento.grupo ? formEvento.grupo : null,
    };
    guardandoRef.current = true;
    setGuardandoEvento(true);
    try {
      if (eventoEditando) {
        await actualizarEvento(eventoEditando, datos);
      } else {
        await crearEvento(datos, { agregarAGoogleCalendar });
      }
      await cargarEventos(calendarioActivo);
      alGuardar(datos.fecha);
      setModalEvento(false);
      if (eventoEditando) avisoEditado("Evento actualizado");
      else avisoCreado("Evento creado");
    } catch (err) {
      avisoError(err.message || "No se pudo guardar el evento.");
    } finally {
      guardandoRef.current = false;
      setGuardandoEvento(false);
    }
  };

  const pedirEliminar = async (ev) => {
    antesDeEliminar();
    const { isConfirmed } = await confirmarEliminacion(ev.titulo);
    if (!isConfirmed) return;
    try {
      await eliminarEvento(ev.id);
      await cargarEventos(calendarioActivo);
      avisoEliminado("Evento eliminado");
    } catch (err) {
      avisoError(err.message || "No se pudo eliminar el evento.");
    }
  };

  const eliminarDesdeEdicion = () => {
    const ev = eventos.find((e) => e.id === eventoEditando);
    setModalEvento(false);
    if (ev) pedirEliminar(ev);
  };

  return {
    modalEvento, setModalEvento,
    formEvento, setFormEvento,
    eventoEditando, guardandoEvento,
    errorEvento, setErrorEvento,
    abrirNuevoEventoEnFecha, abrirEditarEvento,
    guardarEvento, pedirEliminar, eliminarDesdeEdicion,
  };
}
