// Helpers compartidos por los layouts (constantes y utilidades).

export const ROL_ETIQUETA = {
  superusuario: 'Superusuario',
  admin: 'Administrador',
  docente: 'Docente',
  alumno: 'Alumno',
  tutor: 'Padre/Tutor',
};

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

// Solo para uso en móvil: abrevia la primera palabra de un nombre de adscripción
// cuando es un término institucional largo (Departamento → Dpto., etc.).
export function abreviarAdscripcion(texto) {
  if (!texto) return texto;
  const palabras = texto.split(' ');
  const abrev = ABREV_PRIMERA[palabras[0].toLowerCase()];
  if (!abrev) return texto;
  return [abrev, ...palabras.slice(1)].join(' ');
}
