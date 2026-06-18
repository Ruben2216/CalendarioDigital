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
  { valor: "amarillo", etiqueta: "Amarillo" },
  { valor: "rosa", etiqueta: "Rosa" },
  { valor: "cian", etiqueta: "Cian" },
];

/* Áreas (componentes de formación del COBACH) */
export const AREAS = [
  "Lenguaje y Comunicación",
  "Pensamiento Matemático",
  "Ciencias Naturales y Experimentales",
  "Ciencias Sociales y Humanidades",
  "Cultura Digital",
  "Físico-Matemáticas",
  "Químico-Biológicas",
  "Económico-Administrativas",
  "Humanidades y Ciencias Sociales",
  "Formación para el Trabajo",
];

/* Catálogos del alcance de un evento y sus filtros.
   En un evento, semestre/grupo/plantel en null (aplica a todos) */
export const SEMESTRES = [1, 2, 3, 4, 5, 6];

export const GRUPOS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

export const TURNOS = ["Matutino", "Vespertino"];

export function alcanceEvento(ev) {
  const partes = [];
  if (ev.semestre != null) partes.push(`${ev.semestre}.º`);
  if (ev.grupo != null) partes.push(`Grupo ${ev.grupo}`);
  return partes.length ? partes.join(" · ") : "Todos los grupos";
}
