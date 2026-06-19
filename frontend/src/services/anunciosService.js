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

export async function listarAnuncios({ publico = false, plantelFiltro = '' } = {}) {
    const url = new URL(`${BASE_URL}/api/anuncios/`);
    const sesion = publico ? null : obtenerSesion();
    if (sesion) {
        if (sesion.id_usuario != null) url.searchParams.set('id_usuario', sesion.id_usuario);
        if (sesion.rol) url.searchParams.set('rol', sesion.rol);
        if (sesion.plantel?.nombre) url.searchParams.set('plantel', sesion.plantel.nombre);
    }
    // Filtro de plantel del superusuario
    if (plantelFiltro) url.searchParams.set('plantel_filtro', plantelFiltro);
    const resp = await fetch(url, { headers: headers() });
    if (!resp.ok) throw new Error('No se pudieron cargar los anuncios.');
    return resp.json();
}

export async function crearAnuncio(datos) {
    const resp = await fetch(`${BASE_URL}/api/anuncios/`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ ...datos, id_usuario: idUsuario() }),
    });
    const cuerpo = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(cuerpo.error || 'No se pudo crear el anuncio.');
    return cuerpo;
}

export async function actualizarAnuncio(idAnuncio, datos) {
    const resp = await fetch(`${BASE_URL}/api/anuncios/${idAnuncio}/`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ ...datos, id_usuario: idUsuario() }),
    });
    const cuerpo = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(cuerpo.error || 'No se pudo actualizar el anuncio.');
    return cuerpo;
}

export async function eliminarAnuncio(idAnuncio) {
    const resp = await fetch(`${BASE_URL}/api/anuncios/${idAnuncio}/?id_usuario=${idUsuario()}`, {
        method: 'DELETE',
        headers: headers(),
    });
    if (!resp.ok && resp.status !== 204) {
        const cuerpo = await resp.json().catch(() => ({}));
        throw new Error(cuerpo.error || 'No se pudo eliminar el anuncio.');
    }
}
