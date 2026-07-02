
/* Roles que el superusuario puede otorgar desde /usuarios. El admin gestiona
   fechas de su plantel; el colaborador gestiona el calendario oficial y todos
   los planteles (sin acceso a mensajería ni usuarios). */
export const ROLES_GESTION = {
  admin: {
    id: "admin",
    etiqueta: "Administrador",
    color: "azul",
    descripcion: "Puede agregar y modificar fechas en su plantel asignado.",
  },
  colaborador: {
    id: "colaborador",
    etiqueta: "Colaborador",
    color: "morado",
    descripcion: "Puede agregar y modificar fechas del calendario oficial y de todos los planteles.",
  },
};

export const ROL = ROLES_GESTION.admin;

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
  { id: "mixto", etiqueta: "Mixto", color: "gris" },
];
