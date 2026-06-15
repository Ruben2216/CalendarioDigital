export const PLANTELES = [
  "COBACH 01 - Tuxtla Terán",
  "COBACH 02 - San Cristóbal",
  "COBACH 03 - Tapachula",
  "COBACH 04 - Comitán",
  "COBACH 05 - Pichucalco",
  "COBACH 06 - Palenque",
  "COBACH 07 - Arriaga",
  "COBACH 08 - Villaflores",
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

export function usuariosIniciales() {
  return [
    { id: 1, nombre: "José Rubén Gómez Pérez", correo: "jruben@cobach.edu.mx", planteles: ["COBACH 01 - Tuxtla Terán"], estado: "activo", solicitado: "2026-05-12" },
    { id: 2, nombre: "María Fernanda Aguilar", correo: "mfaguilar@cobach.edu.mx", planteles: ["COBACH 02 - San Cristóbal", "COBACH 04 - Comitán"], estado: "activo", solicitado: "2026-05-20" },
    { id: 3, nombre: "Carlos Eduardo Ramírez", correo: "cramirez@cobach.edu.mx", planteles: ["COBACH 03 - Tapachula"], estado: "pendiente", solicitado: "2026-06-08" },
    { id: 4, nombre: "Ana Lucía Hernández", correo: "ahernandez@cobach.edu.mx", planteles: ["COBACH 05 - Pichucalco"], estado: "pendiente", solicitado: "2026-06-10" },
    { id: 5, nombre: "Luis Ángel Martínez", correo: "lmartinez@cobach.edu.mx", planteles: ["COBACH 06 - Palenque"], estado: "rechazado", solicitado: "2026-05-28" },
    { id: 6, nombre: "Diana Patricia Vázquez", correo: "dvazquez@cobach.edu.mx", planteles: ["COBACH 07 - Arriaga", "COBACH 08 - Villaflores"], estado: "activo", solicitado: "2026-04-30" },
    { id: 7, nombre: "Roberto Jiménez Cruz", correo: "rjimenez@cobach.edu.mx", planteles: ["COBACH 01 - Tuxtla Terán"], estado: "pendiente", solicitado: "2026-06-13" },
  ];
}
