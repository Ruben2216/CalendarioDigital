const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? '';

function headers() {
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };
}

// Lista de planteles desde la BD
export async function listarPlanteles() {
    const resp = await fetch(`${BASE_URL}/api/planteles/`, { headers: headers() });
    if (!resp.ok) throw new Error('No se pudieron cargar los planteles.');
    return resp.json();
}

// Lista de agrupaciones organizacionales
export async function listarAgrupaciones() {
    const resp = await fetch(`${BASE_URL}/api/agrupaciones/`, { headers: headers() });
    if (!resp.ok) throw new Error('No se pudieron cargar las agrupaciones.');
    return resp.json();
}
