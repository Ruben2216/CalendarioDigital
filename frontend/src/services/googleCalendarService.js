import { obtenerSesion } from './authService';

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? '';

const SCOPES = [
    'openid',
    'email',
    'https://www.googleapis.com/auth/calendar.events',
].join(' ');

function headers() {
    return { 'Content-Type': 'application/json', 'Accept': 'application/json' };
}

export function urlAutorizacion() {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const redirectUri = `${window.location.origin}/calendar/callback`;

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPES,
        access_type: 'offline',
        prompt: 'select_account consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// Retorna { vinculado: bool, email: string|null }
export async function verificarVinculo() {
    const id = obtenerSesion()?.id_usuario;
    if (!id) return { vinculado: false, email: null };
    const resp = await fetch(`${BASE_URL}/api/auth/google/calendar/vincular/?id_usuario=${id}`, {
        headers: headers(),
    });
    if (!resp.ok) return { vinculado: false, email: null };
    return resp.json();
}

export async function vincular(code, redirectUri) {
    const id = obtenerSesion()?.id_usuario;
    const resp = await fetch(`${BASE_URL}/api/auth/google/calendar/vincular/`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ id_usuario: id, code, redirect_uri: redirectUri }),
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'No se pudo vincular Google Calendar.');
    }
    return resp.json();
}

export async function desvincular() {
    const id = obtenerSesion()?.id_usuario;
    const resp = await fetch(`${BASE_URL}/api/auth/google/calendar/vincular/?id_usuario=${id}`, {
        method: 'DELETE',
        headers: headers(),
    });
    if (!resp.ok) throw new Error('No se pudo desvincular Google Calendar.');
}
