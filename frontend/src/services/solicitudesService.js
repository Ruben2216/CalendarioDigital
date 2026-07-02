import { BASE_URL, idUsuario, peticionJson, peticionSinCuerpo } from './api';

// Solicitud pendiente del usuario actual (o null si no tiene).
export async function miSolicitudPendiente() {
    const id = idUsuario();
    const datos = await peticionJson(
        `${BASE_URL}/api/solicitudes-admin/mia/?id_usuario=${id}`,
        {},
        'No se pudo consultar tu solicitud.'
    );
    return datos.solicitud; // objeto o null
}

// Envía una solicitud. Si ya existe una pendiente, el backend la devuelve
export async function enviarSolicitud(payload) {
    return peticionJson(
        `${BASE_URL}/api/solicitudes-admin/`,
        {
            method: 'POST',
            body: JSON.stringify({ ...payload, id_usuario: idUsuario() }),
        },
        'No se pudo enviar la solicitud.'
    ); // { ya_existe, solicitud }
}

// Lista de solicitudes (para admin/superusuario).
export async function listarSolicitudes(estado) {
    const url = new URL('/api/solicitudes-admin/', window.location.origin);
    if (estado) url.searchParams.set('estado', estado);
    return peticionJson(url, {}, 'No se pudieron cargar las solicitudes.');
}

export async function listarAdministradores() {
    const url = new URL('/api/usuarios/', window.location.origin);
    url.searchParams.set('rol', 'admin,colaborador');
    return peticionJson(url, {}, 'No se pudieron cargar los administradores.'); // [{ id, nombre, correo, planteles: [{plantel, turno}], rol }]
}

// Superusuario crea un admin (con plantel y turno) o un colaborador directamente.
export async function crearAdmin(datos) {
    return peticionJson(
        `${BASE_URL}/api/usuarios/crear-admin/`,
        {
            method: 'POST',
            body: JSON.stringify({ ...datos, id_usuario: idUsuario() }),
        },
        'No se pudo crear el administrador.'
    );
}

// Superusuario actualiza el plantel/turno (y opcionalmente nombre) de un admin.
export async function actualizarAdmin(idAdmin, datos) {
    return peticionJson(
        `${BASE_URL}/api/usuarios/${idAdmin}/actualizar/`,
        {
            method: 'PATCH',
            body: JSON.stringify({ ...datos, id_usuario: idUsuario() }),
        },
        'No se pudo actualizar el administrador.'
    );
}

// Acepta o rechaza una solicitud. Al aceptar, el backend cambia el rol a admin.
export async function resolverSolicitud(idSolicitud, accion) {
    const datos = await peticionJson(
        `${BASE_URL}/api/solicitudes-admin/${idSolicitud}/resolver/`,
        {
            method: 'POST',
            body: JSON.stringify({ accion, id_usuario: idUsuario() }),
        },
        'No se pudo procesar la solicitud.'
    );
    return datos.solicitud;
}

// Elimina la solicitud de la BD. No afecta al usuario ni a su rol.
export async function eliminarSolicitud(idSolicitud) {
    const url = new URL(`/api/solicitudes-admin/${idSolicitud}/`, window.location.origin);
    url.searchParams.set('id_usuario', idUsuario());
    return peticionSinCuerpo(url, { method: 'DELETE' }, 'No se pudo eliminar la solicitud.');
}
