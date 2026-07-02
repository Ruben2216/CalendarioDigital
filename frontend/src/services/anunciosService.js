import { obtenerSesion } from './authService';
import { BASE_URL, idUsuario, peticionJson, peticionSinCuerpo } from './api';

export async function listarAnuncios({ publico = false, plantelFiltro = '' } = {}) {
    const url = new URL('/api/anuncios/', window.location.origin);
    const sesion = publico ? null : obtenerSesion();
    if (sesion) {
        if (sesion.id_usuario != null) url.searchParams.set('id_usuario', sesion.id_usuario);
        if (sesion.rol) url.searchParams.set('rol', sesion.rol);
        if (sesion.plantel?.nombre) url.searchParams.set('plantel', sesion.plantel.nombre);
        if (sesion.turno?.nombre) url.searchParams.set('turno', sesion.turno.nombre);
    }
    // Filtro de plantel del superusuario
    if (plantelFiltro) url.searchParams.set('plantel_filtro', plantelFiltro);
    return peticionJson(url, {}, 'No se pudieron cargar los anuncios.');
}

export async function crearAnuncio(datos) {
    return peticionJson(
        `${BASE_URL}/api/anuncios/`,
        {
            method: 'POST',
            body: JSON.stringify({ ...datos, id_usuario: idUsuario() }),
        },
        'No se pudo crear el anuncio.'
    );
}

export async function actualizarAnuncio(idAnuncio, datos) {
    return peticionJson(
        `${BASE_URL}/api/anuncios/${idAnuncio}/`,
        {
            method: 'PUT',
            body: JSON.stringify({ ...datos, id_usuario: idUsuario() }),
        },
        'No se pudo actualizar el anuncio.'
    );
}

export async function eliminarAnuncio(idAnuncio) {
    return peticionSinCuerpo(
        `${BASE_URL}/api/anuncios/${idAnuncio}/?id_usuario=${idUsuario()}`,
        { method: 'DELETE' },
        'No se pudo eliminar el anuncio.'
    );
}
