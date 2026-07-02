import { obtenerSesion } from './authService';
import { BASE_URL, idUsuario, peticionJson, peticionSinCuerpo } from './api';

export async function listarCalendarios() {
    return peticionJson(`${BASE_URL}/api/calendarios/`, {}, 'No se pudieron cargar los calendarios.');
}

export async function listarTipos() {
    const id = idUsuario();
    const url = new URL('/api/tipos-evento/', window.location.origin);
    if (id != null) url.searchParams.set('id_usuario', id);
    return peticionJson(url, {}, 'No se pudieron cargar los tipos de evento.');
}

/* Eventos visibles del calendario como el alumno no existe en BD (datos desde la API) su visibilidad filtra por
rol/plantel/turno, Los que no tienen cuenta no envían sesión */
export async function listarEventos(idCalendario, { publico = false, plantelFiltro = '' } = {}) {
    const url = new URL('/api/eventos/', window.location.origin);
    url.searchParams.set('id_calendario', idCalendario);
    const sesion = publico ? null : obtenerSesion();
    if (sesion) {
        if (sesion.id_usuario != null) url.searchParams.set('id_usuario', sesion.id_usuario);
        if (sesion.rol) url.searchParams.set('rol', sesion.rol);

        if (sesion.plantel?.id) {
            url.searchParams.set('plantel_id', sesion.plantel.id);
        } else if (sesion.plantel?.nombre) {
            url.searchParams.set('plantel', sesion.plantel.nombre);
        }
        if (sesion.turno?.nombre) url.searchParams.set('turno', sesion.turno.nombre);

        if (sesion.rol === 'alumno') {
            if (sesion.semestre != null) url.searchParams.set('semestre', sesion.semestre);
            if (sesion.grupo) url.searchParams.set('grupo', sesion.grupo);
        }
    }
    // Filtro de plantel del superusuario
    if (plantelFiltro) url.searchParams.set('plantel_filtro', plantelFiltro);
    return peticionJson(url, {}, 'No se pudieron cargar los eventos.');
}

export async function crearEvento(datos, { agregarAGoogleCalendar = true } = {}) {
    return peticionJson(
        `${BASE_URL}/api/eventos/`,
        {
            method: 'POST',
            body: JSON.stringify({ ...datos, id_usuario: idUsuario(), agregar_a_google_calendar: agregarAGoogleCalendar }),
        },
        'No se pudo crear el evento.'
    );
}

export async function actualizarEvento(idEvento, datos) {
    return peticionJson(
        `${BASE_URL}/api/eventos/${idEvento}/`,
        {
            method: 'PUT',
            body: JSON.stringify({ ...datos, id_usuario: idUsuario() }),
        },
        'No se pudo actualizar el evento.'
    );
}

export async function eliminarEvento(idEvento) {
    return peticionSinCuerpo(
        `${BASE_URL}/api/eventos/${idEvento}/?id_usuario=${idUsuario()}`,
        { method: 'DELETE' },
        'No se pudo eliminar el evento.'
    );
}

export async function crearTipo({ nombre, color_hex, plantel_id }) {
    return peticionJson(
        `${BASE_URL}/api/tipos-evento/`,
        {
            method: 'POST',
            body: JSON.stringify({ nombre, color_hex, plantel_id, id_usuario: idUsuario() }),
        },
        'No se pudo crear el tipo.'
    );
}

export async function actualizarTipo(idTipo, { nombre, color_hex }) {
    return peticionJson(
        `${BASE_URL}/api/tipos-evento/${idTipo}/`,
        {
            method: 'PUT',
            body: JSON.stringify({ nombre, color_hex, id_usuario: idUsuario() }),
        },
        'No se pudo actualizar el tipo.'
    );
}

export async function eliminarTipo(idTipo) {
    return peticionSinCuerpo(
        `${BASE_URL}/api/tipos-evento/${idTipo}/?id_usuario=${idUsuario()}`,
        { method: 'DELETE' },
        'No se pudo eliminar el tipo.'
    );
}
