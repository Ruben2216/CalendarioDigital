export const MAX_COLORES_DIA = 4;

const TEXTO_OSCURO = "#1f2937";
const TEXTO_CLARO = "#ffffff";

/* Colores únicos (por tipo de evento) de un día, en el orden en que aparecen.
   Se limita a MAX_COLORES_DIA para que el cuadro del día siga siendo legible. */
export function coloresDeDia(eventos, colorTipo, max = MAX_COLORES_DIA) {
  const vistos = new Set();
  const colores = [];
  for (const ev of eventos) {
    const color = colorTipo(ev.tipo);
    if (vistos.has(color)) continue;
    vistos.add(color);
    colores.push(color);
    if (colores.length >= max) break;
  }
  return colores;
}

function luminancia(hex) {
  const c = (hex || "").replace("#", "");
  if (c.length !== 6) return 0;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/* Texto oscuro o claro según la luminancia media de los colores de fondo. */
export function textoLegibleSobre(colores) {
  const lista = Array.isArray(colores) ? colores : [colores];
  if (lista.length === 0) return TEXTO_OSCURO;
  const media = lista.reduce((suma, hex) => suma + luminancia(hex), 0) / lista.length;
  return media > 165 ? TEXTO_OSCURO : TEXTO_CLARO;
}
