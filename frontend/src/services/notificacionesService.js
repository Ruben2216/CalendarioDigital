import { obtenerSesion } from './authService';

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

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
    }
    const resp = await fetch(url, { headers: headers() });
    if (!resp.ok) throw new Error('No se pudieron cargar las notificaciones.');
    return resp.json();
}
