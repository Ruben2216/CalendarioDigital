/**
 * @param {object} form 
 * @param {object} opciones
 * @param {string} [opciones.hoy] 
 * @returns {{campo: string, mensaje: string} | null} 
 */
export function validarEvento(form, { hoy = "" } = {}) {
  if (!form.fecha) {
    return { campo: "fecha", mensaje: "Selecciona la fecha de inicio." };
  }
  if (hoy && form.fecha < hoy) {
    return { campo: "fecha", mensaje: "No puedes programar un evento en una fecha pasada." };
  }
  if (form.fechaFin && form.fechaFin < form.fecha) {
    return { campo: "fecha", mensaje: "La fecha de fin no puede ser anterior a la de inicio." };
  }

  if (!form.todoElDia) {
    if (!form.horaInicio || !form.horaFin) {
      return { campo: "hora", mensaje: 'Indica la hora de inicio y de fin, o activa "Todo el día".' };
    }
    const mismoDia = !form.fechaFin || form.fechaFin === form.fecha;
    if (mismoDia && form.horaFin <= form.horaInicio) {
      return { campo: "hora", mensaje: "La hora de fin debe ser posterior a la de inicio." };
    }
  }

  return null;
}
