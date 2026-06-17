export const PLANTELES = [
  "COBACH 01 - Tuxtla Terán",
  "Plantel 02 - Escuintla",
  "Plantel 03 - Cacahoatán",
  "Plantel 04 - Pijijiapan",
  "Plantel 05 - Huehuetan",
  "Plantel 06 - Reforma",
  "Plantel 07 - Palenque",
  "Plantel 08 - Tapachula",
  "COBACH 09 -Catazaja",
  "Plantel 10 Comitán",
  "Plantel 11 San Cristóbal",
  "Plantel 12 San José Pathuitz",
  "Plantel 13 Tuxtla Oriente",


];

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
