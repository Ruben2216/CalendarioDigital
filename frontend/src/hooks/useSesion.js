export function useSesion() {
  const raw = localStorage.getItem('sesion');
  if (!raw) return { rol: '', nombre: '', iniciales: '', plantel: null, turno: null, permisos_especiales: [] };
  const sesion = JSON.parse(raw);
  const nombre = sesion.nombre || '';
  const iniciales = nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('');
  return { ...sesion, nombre, iniciales };
}
