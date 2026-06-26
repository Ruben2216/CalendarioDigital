export const EVENTO_NOTIF = "notificaciones-cambio";

function idSesion() {
    const raw = localStorage.getItem("sesion");
    if (!raw) return "anon";
    try { return JSON.parse(raw).id_usuario ?? "anon"; } catch { return "anon"; }
}

function leer(prefijo) {
    try {
        return new Set(JSON.parse(localStorage.getItem(`${prefijo}:${idSesion()}`) || "[]"));
    } catch {
        return new Set();
    }
}

function guardar(prefijo, set) {
    localStorage.setItem(`${prefijo}:${idSesion()}`, JSON.stringify([...set]));
    window.dispatchEvent(new Event(EVENTO_NOTIF));
}

export function idsLeidas() { return leer("notifLeidas"); }
export function idsOcultas() { return leer("notifOcultas"); }

export function marcarTodasLeidas(notificaciones) {
    const set = idsLeidas();
    notificaciones.forEach((n) => set.add(n.id));
    guardar("notifLeidas", set);
}

export function marcarUnaLeida(id) {
    const set = idsLeidas();
    if (set.has(id)) return;
    set.add(id);
    guardar("notifLeidas", set);
}

export function limpiarTodas(notificaciones) {
    const set = idsOcultas();
    notificaciones.forEach((n) => set.add(n.id));
    guardar("notifOcultas", set);
}
