export function leerSesion() {
  const raw = localStorage.getItem('sesion');
  if (!raw) {
    return { rol: '', nombre: '', iniciales: '', plantel: null, turno: null, planteles: [], permisos_especiales: [] };
  }
  const sesion = JSON.parse(raw);
  const nombre = sesion.nombre || '';
  const iniciales = nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('');
  const primera = Array.isArray(sesion.planteles) ? sesion.planteles[0] : null;
  const plantel = sesion.plantel ?? primera?.plantel ?? null;
  const turno = sesion.turno ?? primera?.turno ?? null;
  return { ...sesion, nombre, iniciales, plantel, turno };
}

export function useSesion() {
  return leerSesion();
}
