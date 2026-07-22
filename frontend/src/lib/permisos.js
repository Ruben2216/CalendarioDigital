export const esAlumno = (sesion) => sesion?.rol === "alumno";
export const esDocente = (sesion) => sesion?.rol === "docente";
export const esAdmin = (sesion) => sesion?.rol === "admin";
export const esSuperusuario = (sesion) => sesion?.rol === "superusuario";
export const esColaborador = (sesion) => sesion?.rol === "colaborador";
export const esTutor = (sesion) => sesion?.rol === "tutor";

// Gestión global del calendario: superusuario, colaborador, director y
// subdirector de departamento comparten vista y alcance de lectura total.
export const esGestorGlobal = (sesion) => esSuperusuario(sesion) || esColaborador(sesion) || sesion?.rol === "director_departamento" || sesion?.rol === "subdirector_departamento";

export function plantelesPermitidos(sesion) {
  if (esAlumno(sesion)) return sesion.plantel?.nombre ? [sesion.plantel.nombre] : [];
  if (esDocente(sesion) || esAdmin(sesion)) {
    return [...new Set((sesion.planteles || []).map((a) => a.plantel?.nombre).filter(Boolean))];
  }
  return [];
}

export function turnosPermitidos(sesion) {
  if (esAlumno(sesion)) return sesion.turno?.nombre ? [sesion.turno.nombre] : [];
  if (esDocente(sesion) || esAdmin(sesion)) {
    return [...new Set((sesion.planteles || []).map((a) => a.turno?.nombre).filter(Boolean))];
  }
  return [];
}
