export const EVENTO_BASE = {
  titulo: "",
  tipo: "",
  area: "",
  fecha: "",
  fechaFin: "",
  horaInicio: "",
  horaFin: "",
  lugar: "",
  plantel: "",
  turno: "",
  formato: "punto",
  todoElDia: false,
  especifico: false,
  semestre: "",
  grupo: "",
  publico: false,
};

export const FORM_EVENTO_VACIO = { ...EVENTO_BASE, agregarAGoogleCalendar: false };

export const FORM_SOLICITUD_VACIO = { ...EVENTO_BASE, recursos: [], observaciones: "" };
