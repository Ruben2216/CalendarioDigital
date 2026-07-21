import { obtenerSesion } from './authService';

const BASE_URL =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : (import.meta.env.VITE_BACKEND_URL ?? '');

function headers() {
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': '1',
    };
}

// Centro de notificaciones (campana). Filtra por rol/plantel
export async function listarNotificaciones() {
    const url = new URL(`${BASE_URL}/api/notificaciones/`);
    const sesion = obtenerSesion();
    if (sesion) {
        if (sesion.id_usuario != null) url.searchParams.set('id_usuario', sesion.id_usuario);
        if (sesion.rol) url.searchParams.set('rol', sesion.rol);
        if (sesion.plantel?.nombre) url.searchParams.set('plantel', sesion.plantel.nombre);
        if (sesion.turno?.nombre) url.searchParams.set('turno', sesion.turno.nombre);
    }
    const resp = await fetch(url, { headers: headers() });
    if (!resp.ok) throw new Error('No se pudieron cargar las notificaciones.');
    return resp.json();
}

// Marca como leída una notificación personal (o todas)
export async function marcarNotificacionLeida(id = null) {
    const sesion = obtenerSesion();
    if (!sesion?.id_usuario) return;
    const ruta = id != null ? `${id}/leer/` : 'leer/';
    const url = new URL(`${BASE_URL}/api/notificaciones/${ruta}`);
    url.searchParams.set('id_usuario', sesion.id_usuario);
    await fetch(url, { method: 'POST', headers: headers() }).catch(() => {});
}
