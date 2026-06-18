
export const ROL = {
  id: "admin",
  etiqueta: "Administrador",
  color: "azul",
  descripcion: "Puede agregar y modificar fechas en sus planteles asignados.",
};

export const ESTADOS = [
  { id: "pendiente", etiqueta: "Pendiente", color: "naranja" },
  { id: "activo", etiqueta: "Activo", color: "verde" },
  { id: "rechazado", etiqueta: "Rechazado", color: "rojo" },
];

/* Turno en el que el administrador puede gestionar fechas. Solo puede tener
   UNO: Matutino o Vespertino, no ambos. */
export const TURNOS = [
  { id: "matutino", etiqueta: "Matutino", color: "naranja" },
  { id: "vespertino", etiqueta: "Vespertino", color: "marino" },
];
