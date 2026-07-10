// Helpers compartidos por los layouts (constantes y utilidades).

export const ROL_ETIQUETA = {
  superusuario: 'Superusuario',
  admin: 'Administrador',
  colaborador: 'Colaborador',
  docente: 'Docente',
  alumno: 'Alumno',
  tutor: 'Visitante',
};

// Roles de gestión global: no pertenecen a un solo plantel, administran todos.
const GESTION_GLOBAL = ['superusuario', 'colaborador'];

// Etiqueta ÚNICA del "lugar" del usuario
export function etiquetaLugar({ rol, tipoEmpleado, tienePlantel, nombreLugar } = {}) {
  if (GESTION_GLOBAL.includes(rol)) return 'Plantel';
  if (esAreaAdministrativa(nombreLugar)) return 'Departamento';
  if (tienePlantel) return 'Plantel';
  return tipoEmpleado === 'Administrativo' ? 'Departamento' : 'Plantel';
}

export function valorLugar({ rol, nombrePlantel, adscripcion } = {}) {
  if (GESTION_GLOBAL.includes(rol)) return 'Todos los planteles';
  return nombrePlantel || adscripcion || 'Sin plantel';
}

// Ciclo escolar actual (Agosto inicia el nuevo ciclo).
export function cicloEscolar() {
  const anio = new Date().getFullYear();
  return new Date().getMonth() >= 7 ? `${anio}–${anio + 1}` : `${anio - 1}–${anio}`;
}

const ABREV_PRIMERA = {
  departamento: 'Dpto.',
  coordinación: 'Coord.',
  coordinacion: 'Coord.',
  dirección: 'Dir.',
  direccion: 'Dir.',
  subdirección: 'Subdir.',
  subdireccion: 'Subdir.',
  jefatura: 'Jef.',
  secretaría: 'Secr.',
  secretaria: 'Secr.',
  división: 'Div.',
  division: 'Div.',
  área: 'Área',
  area: 'Área',
  oficina: 'Of.',
};

export function esAreaAdministrativa(nombre) {
  if (!nombre) return false;
  const primera = nombre.trim().split(/\s+/)[0]?.toLowerCase();
  return Boolean(primera) && Object.prototype.hasOwnProperty.call(ABREV_PRIMERA, primera);
}

// Solo para uso en móvil: abrevia la primera palabra de un nombre de adscripción
// cuando es un término institucional largo (Departamento → Dpto., etc.).
export function abreviarAdscripcion(texto) {
  if (!texto) return texto;
  const palabras = texto.split(' ');
  const abrev = ABREV_PRIMERA[palabras[0].toLowerCase()];
  if (!abrev) return texto;
  return [abrev, ...palabras.slice(1)].join(' ');
}
