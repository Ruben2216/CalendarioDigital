// Helpers compartidos por los layouts (constantes y utilidades sin JSX).

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
