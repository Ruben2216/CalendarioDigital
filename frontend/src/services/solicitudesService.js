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

// Solicitud pendiente del usuario actual (o null si no tiene).
export async function miSolicitudPendiente() {
    const id = idUsuario();
    const resp = await fetch(`${BASE_URL}/api/solicitudes-admin/mia/?id_usuario=${id}`, {
        headers: headers(),
    });
    if (!resp.ok) throw new Error('No se pudo consultar tu solicitud.');
    const datos = await resp.json();
    return datos.solicitud; // objeto o null
}

// Envía una solicitud. Si ya existe una pendiente, el backend la devuelve
export async function enviarSolicitud(payload) {
    const resp = await fetch(`${BASE_URL}/api/solicitudes-admin/`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ ...payload, id_usuario: idUsuario() }),
    });
    const datos = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(datos.error || 'No se pudo enviar la solicitud.');
    return datos; // { ya_existe, solicitud }
}

// Lista de solicitudes (para admin/superusuario).
export async function listarSolicitudes(estado) {
    const url = new URL(`${BASE_URL}/api/solicitudes-admin/`);
    if (estado) url.searchParams.set('estado', estado);
    const resp = await fetch(url, { headers: headers() });
    if (!resp.ok) throw new Error('No se pudieron cargar las solicitudes.');
    return resp.json();
}

export async function listarAdministradores() {
    const url = new URL(`${BASE_URL}/api/usuarios/`);
    url.searchParams.set('rol', 'admin');
    const resp = await fetch(url, { headers: headers() });
    if (!resp.ok) throw new Error('No se pudieron cargar los administradores.');
    return resp.json(); // [{ id, nombre, correo, planteles: [{plantel, turno}], rol }]
}

// Superusuario crea un admin directamente con plantel y turno.
export async function crearAdmin(datos) {
    const resp = await fetch(`${BASE_URL}/api/usuarios/crear-admin/`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ ...datos, id_usuario: idUsuario() }),
    });
    const res = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(res.error || 'No se pudo crear el administrador.');
    return res;
}

// Superusuario actualiza el plantel/turno (y opcionalmente nombre) de un admin.
export async function actualizarAdmin(idAdmin, datos) {
    const resp = await fetch(`${BASE_URL}/api/usuarios/${idAdmin}/actualizar/`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ ...datos, id_usuario: idUsuario() }),
    });
    const res = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(res.error || 'No se pudo actualizar el administrador.');
    return res;
}

// Acepta o rechaza una solicitud. Al aceptar, el backend cambia el rol a admin.
export async function resolverSolicitud(idSolicitud, accion) {
    const resp = await fetch(`${BASE_URL}/api/solicitudes-admin/${idSolicitud}/resolver/`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ accion, id_usuario: idUsuario() }),
    });
    const datos = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(datos.error || 'No se pudo procesar la solicitud.');
    return datos.solicitud;
}
