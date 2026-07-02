import { iniciales } from '../lib/texto.js';

export function leerSesion() {
  const raw = localStorage.getItem('sesion');
  if (!raw) {
    return { rol: '', nombre: '', iniciales: '', plantel: null, turno: null, planteles: [] };
  }
  const sesion = JSON.parse(raw);
  const nombre = sesion.nombre || '';
  const primera = Array.isArray(sesion.planteles) ? sesion.planteles[0] : null;
  const plantel = sesion.plantel ?? primera?.plantel ?? null;
  const turno = sesion.turno ?? primera?.turno ?? null;
  return { ...sesion, nombre, iniciales: iniciales(nombre), plantel, turno };
}

export function useSesion() {
  return leerSesion();
}
