import { ANUNCIOS_INICIALES } from "../data/anuncios.js";

let anuncios = [...ANUNCIOS_INICIALES];

export function leerAnuncios() {
  return anuncios;
}

export function crearAnuncio(datos) {
  const nuevo = {
    ...datos,
    id: Date.now(),
    fecha: new Date().toISOString().slice(0, 10),
  };
  anuncios = [nuevo, ...anuncios];
  return anuncios;
}

export function actualizarAnuncio(id, datos) {
  anuncios = anuncios.map((a) => (a.id === id ? { ...a, ...datos } : a));
  return anuncios;
}

export function eliminarAnuncio(id) {
  anuncios = anuncios.filter((a) => a.id !== id);
  return anuncios;
}

/* Anuncios visibles para una audiencia (incluye los dirigidos a "todos"). */
export function anunciosPara(audiencia) {
  return anuncios.filter((a) => a.audiencia === "todos" || a.audiencia === audiencia);
}
