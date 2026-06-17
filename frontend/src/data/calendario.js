// Datos del calendario compartidos por todas las interfaces

/* Colores disponibles para los tipos de evento (mapean a styles/ui.css). */
export const COLORES_TIPO = [
  { valor: "azul", etiqueta: "Azul" },
  { valor: "naranja", etiqueta: "Naranja" },
  { valor: "morado", etiqueta: "Morado" },
  { valor: "verde", etiqueta: "Verde" },
  { valor: "teal", etiqueta: "Verde azulado" },
  { valor: "marino", etiqueta: "Azul marino" },
  { valor: "rojo", etiqueta: "Rojo" },
];

/* Tipos de evento: fuente única para colores, filtros y simbología. */
export const TIPOS = [
  { id: "academico", etiqueta: "Académico", color: "azul" },
  { id: "administrativo", etiqueta: "Administrativo", color: "naranja" },
  { id: "cultural", etiqueta: "Cultural", color: "morado" },
  { id: "deportivo", etiqueta: "Deportivo", color: "verde" },
  { id: "institucional", etiqueta: "Institucional", color: "marino" },
  { id: "formacion", etiqueta: "Formación", color: "teal" },
  { id: "urgente", etiqueta: "Urgente", color: "rojo" },
];

export const AREAS = [
  "Académica", "Administrativa", "Deportiva",
  "Cultural", "Formación", "Institucional",
];

/* Catálogos del alcance de un evento y sus filtros.
   En un evento, semestre/grupo/plantel en null (aplica a todos) */
export const SEMESTRES = [1, 2, 3, 4, 5, 6];

export const GRUPOS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

export const PLANTELES = [
  "Plantel 01 - Tuxtla",
  "Plantel 02 - San Cristóbal",
  "Plantel 13 - Tuxtla Oriente",
];

export const TURNOS = ["Matutino", "Vespertino"];

export function alcanceEvento(ev) {
  const partes = [];
  if (ev.semestre != null) partes.push(`${ev.semestre}.º`);
  if (ev.grupo != null) partes.push(`Grupo ${ev.grupo}`);
  return partes.length ? partes.join(" · ") : "Todos los grupos";
}

/* Eventos de ejemplo (junio 2026, ciclo activo de la demo).
   `formato`: "punto" (puntual) o "rango" (barra/periodo, abarca días). */
export function eventosIniciales() {
  return [
    { id: 1, titulo: "Curso propedéutico alumnos 1.er semestre", tipo: "cultural", area: "Cultural", fecha: "2026-06-02", fechaFin: "2026-06-04", horaInicio: "", horaFin: "", lugar: "Auditorio", formato: "rango", semestre: 1, grupo: null, plantel: null, turno: null },
    { id: 2, titulo: "Examen parcial de Matemáticas", tipo: "academico", area: "Académica", fecha: "2026-06-10", horaInicio: "08:00", horaFin: "10:00", lugar: "Aula 12-B", formato: "punto", semestre: 2, grupo: "A", plantel: "Plantel 01 - Tuxtla", turno: "Matutino" },
    { id: 3, titulo: "Reunión de trabajo colegiado", tipo: "administrativo", area: "Administrativa", fecha: "2026-06-10", horaInicio: "10:00", horaFin: "12:00", lugar: "Sala de juntas", formato: "punto", semestre: null, grupo: null, plantel: null, turno: null },
    { id: 4, titulo: "Torneo deportivo interplantel", tipo: "deportivo", area: "Deportiva", fecha: "2026-06-10", horaInicio: "13:00", horaFin: "17:00", lugar: "Plantel 01 – Tuxtla", formato: "punto", semestre: null, grupo: null, plantel: null, turno: null },
    { id: 5, titulo: "Capacitación docente", tipo: "formacion", area: "Formación", fecha: "2026-06-10", horaInicio: "16:00", horaFin: "18:00", lugar: "Aula 5", formato: "punto", semestre: null, grupo: null, plantel: null, turno: "Vespertino" },
    { id: 6, titulo: "Entrega de calificaciones", tipo: "academico", area: "Académica", fecha: "2026-06-12", horaInicio: "09:00", horaFin: "14:00", lugar: "Control escolar", formato: "punto", semestre: null, grupo: null, plantel: null, turno: null },
    { id: 7, titulo: "Ceremonia cívica", tipo: "institucional", area: "Institucional", fecha: "2026-06-22", horaInicio: "08:00", horaFin: "09:00", lugar: "Explanada", formato: "punto", semestre: null, grupo: null, plantel: null, turno: null },
    { id: 8, titulo: "Receso intersemestral", tipo: "institucional", area: "Institucional", fecha: "2026-06-28", fechaFin: "2026-06-29", horaInicio: "", horaFin: "", lugar: "Toda la comunidad", formato: "rango", semestre: null, grupo: null, plantel: null, turno: null },
    { id: 9, titulo: "Periodo vacacional", tipo: "urgente", area: "Institucional", fecha: "2026-06-30", horaInicio: "", horaFin: "", lugar: "Toda la comunidad", formato: "rango", semestre: null, grupo: null, plantel: null, turno: null },
  ];
}
