import { obtenerSesion } from './authService';

export const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? '';

export function headers() {
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };
}

export function idUsuario() {
    return obtenerSesion()?.id_usuario ?? null;
}

export async function peticionJson(url, opciones = {}, mensajeError = 'Ocurrió un error.') {
    const resp = await fetch(url, { headers: headers(), ...opciones });
    const cuerpo = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(cuerpo.error || mensajeError);
    return cuerpo;
}

export async function peticionSinCuerpo(url, opciones = {}, mensajeError = 'Ocurrió un error.') {
    const resp = await fetch(url, { headers: headers(), ...opciones });
    if (!resp.ok) {
        const cuerpo = await resp.json().catch(() => ({}));
        throw new Error(cuerpo.error || mensajeError);
    }
}
