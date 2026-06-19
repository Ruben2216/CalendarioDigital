// Estado "leído" de anuncios por usuario, guardado en localStorage. El alumno no
// existe en BD (sus datos vienen de la API), así que el seguimiento de lectura se
// hace del lado del cliente, separado por id de sesión para no mezclar usuarios.
export const EVENTO_LEIDOS = "anuncios-leidos-cambio";

function clave() {
  const raw = localStorage.getItem("sesion");
  let id = "anon";
  if (raw) {
    try { id = JSON.parse(raw).id_usuario ?? "anon"; } catch { id = "anon"; }
  }
  return `anunciosLeidos:${id}`;
}

export function idsLeidos() {
  try {
    return new Set(JSON.parse(localStorage.getItem(clave()) || "[]"));
  } catch {
    return new Set();
  }
}

export function marcarLeido(id) {
  const set = idsLeidos();
  if (set.has(id)) return;
  set.add(id);
  localStorage.setItem(clave(), JSON.stringify([...set]));
  window.dispatchEvent(new Event(EVENTO_LEIDOS));
}

export function contarNoLeidos(anuncios) {
  const set = idsLeidos();
  return anuncios.reduce((n, a) => (set.has(a.id) ? n : n + 1), 0);
}
