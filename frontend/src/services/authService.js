const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

function baseHeaders() {
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': '1',
    };
}

export async function loginInstitucional(userName, password, rol) {
    const respuesta = await fetch(`${BASE_URL}/api/auth/login/`, {
        method: 'POST',
        headers: baseHeaders(),
        body: JSON.stringify({ userName, password, rol }),
    });

    const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
        return { exito: false, error: datos.error || 'Error de autenticación.' };
    }

    return { exito: true, datos };
}

export function guardarSesion(token, sesion) {
    localStorage.setItem('authToken', token);
    localStorage.setItem('sesion', JSON.stringify(sesion));
}

export function obtenerSesion() {
    const sesion = localStorage.getItem('sesion');
    return sesion ? JSON.parse(sesion) : null;
}

export function cerrarSesion() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('sesion');
}
