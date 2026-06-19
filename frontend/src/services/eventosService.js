import { obtenerSesion } from './authService';

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

function headers() {
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': '1',
    };
}

function idUsuario() {
    return obtenerSesion()?.id_usuario ?? null;
}

export async function listarCalendarios() {
    const resp = await fetch(`${BASE_URL}/api/calendarios/`, { headers: headers() });
    if (!resp.ok) throw new Error('No se pudieron cargar los calendarios.');
    return resp.json();
}

export async function listarTipos() {
    const resp = await fetch(`${BASE_URL}/api/tipos-evento/`, { headers: headers() });
    if (!resp.ok) throw new Error('No se pudieron cargar los tipos de evento.');
    return resp.json();
}

/* Eventos visibles del calendario como el alumno no existe en BD (datos desde la API) su visibilidad filtra por
rol/plantel/turno, Los que no tienen cuenta no envían sesión */
export async function listarEventos(idCalendario, { publico = false, plantelFiltro = '' } = {}) {
    const url = new URL(`${BASE_URL}/api/eventos/`);
    url.searchParams.set('id_calendario', idCalendario);
    const sesion = publico ? null : obtenerSesion();
    if (sesion) {
        if (sesion.id_usuario != null) url.searchParams.set('id_usuario', sesion.id_usuario);
        if (sesion.rol) url.searchParams.set('rol', sesion.rol);
        if (sesion.plantel?.nombre) url.searchParams.set('plantel', sesion.plantel.nombre);
        if (sesion.turno?.nombre) url.searchParams.set('turno', sesion.turno.nombre);
    }
    // Filtro de plantel del superusuario
    if (plantelFiltro) url.searchParams.set('plantel_filtro', plantelFiltro);
    const resp = await fetch(url, { headers: headers() });
    if (!resp.ok) throw new Error('No se pudieron cargar los eventos.');
    return resp.json();
}

export async function crearEvento(datos) {
    const resp = await fetch(`${BASE_URL}/api/eventos/`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ ...datos, id_usuario: idUsuario() }),
    });
    const cuerpo = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(cuerpo.error || 'No se pudo crear el evento.');
    return cuerpo;
}

export async function actualizarEvento(idEvento, datos) {
    const resp = await fetch(`${BASE_URL}/api/eventos/${idEvento}/`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ ...datos, id_usuario: idUsuario() }),
    });
    const cuerpo = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(cuerpo.error || 'No se pudo actualizar el evento.');
    return cuerpo;
}

export async function eliminarEvento(idEvento) {
    const resp = await fetch(`${BASE_URL}/api/eventos/${idEvento}/?id_usuario=${idUsuario()}`, {
        method: 'DELETE',
        headers: headers(),
    });
    if (!resp.ok && resp.status !== 204) {
        const cuerpo = await resp.json().catch(() => ({}));
        throw new Error(cuerpo.error || 'No se pudo eliminar el evento.');
    }
}
