const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

function headers() {
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': '1',
    };
}

// Lista de planteles desde la BD
export async function listarPlanteles() {
    const resp = await fetch(`${BASE_URL}/api/planteles/`, { headers: headers() });
    if (!resp.ok) throw new Error('No se pudieron cargar los planteles.');
    return resp.json();
}
