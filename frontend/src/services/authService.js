const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? '';

function baseHeaders() {
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
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

export async function obtenerPlanteles() {
    const respuesta = await fetch(`${BASE_URL}/api/planteles/`, {
        headers: { ...baseHeaders() },
    });
    if (!respuesta.ok) throw new Error('Error al cargar planteles');
    return respuesta.json(); // [{ id, nombre }]
}

export async function obtenerTurnos() {
    const respuesta = await fetch(`${BASE_URL}/api/turnos/`, {
        headers: { ...baseHeaders() },
    });
    if (!respuesta.ok) throw new Error('Error al cargar turnos');
    return respuesta.json(); // [{ id, nombre }]
}

export async function buscarUsuarios(q) {
    const url = new URL('/api/usuarios/', window.location.origin);
    url.searchParams.set('q', q);
    const respuesta = await fetch(url, { headers: baseHeaders() });
    if (!respuesta.ok) throw new Error('Error al buscar usuarios');
    return respuesta.json(); // [{ id, nombre, correo, rol, ... }]
}

export async function guardarConfiguracionPlanteles(selecciones) {
    const sesion = obtenerSesion();
    const respuesta = await fetch(`${BASE_URL}/api/usuarios/asignar-planteles/`, {
        method: 'POST',
        headers: baseHeaders(),
        body: JSON.stringify({ 
            selecciones,
            id_usuario: sesion ? sesion.id_usuario : null
        }),
    });

    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
        return { exito: false, error: datos.error || 'Error al guardar configuración.' };
    }
    if (datos.registros_creados === 0) {
        const detalle = datos.errores?.length ? datos.errores.join(', ') : 'Los planteles seleccionados no existen en el sistema.';
        return { exito: false, error: detalle };
    }

    return { exito: true, datos };
}

export async function refrescarSesion() {
    const sesion = obtenerSesion();
    if (!sesion?.id_usuario || sesion.rol === 'alumno' || sesion.rol === 'tutor') {
        return sesion;
    }
    try {
        const url = new URL('/api/auth/sesion/', window.location.origin);
        url.searchParams.set('id_usuario', sesion.id_usuario);
        const respuesta = await fetch(url, { headers: baseHeaders() });
        if (!respuesta.ok) return sesion;
        const datos = await respuesta.json();
        const actualizada = {
            ...sesion,
            rol: datos.rol,
            nombre: datos.nombre || sesion.nombre,
            planteles: datos.planteles,
        };
        localStorage.setItem('sesion', JSON.stringify(actualizada));
        return actualizada;
    } catch {
        return sesion;
    }
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
