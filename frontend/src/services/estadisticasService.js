import { obtenerSesion } from './authService';

export async function obtenerEstadisticasDashboard() {
    const sesion = obtenerSesion();
    if (!sesion?.id_usuario) return null;
    const url = new URL('/api/estadisticas/dashboard/', window.location.origin);
    url.searchParams.set('id_usuario', sesion.id_usuario);
    const resp = await fetch(url, {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    });
    if (!resp.ok) throw new Error('No se pudieron cargar las estadísticas.');
    return resp.json();
}
