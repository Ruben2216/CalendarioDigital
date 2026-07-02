export function abrirVentanaCentrada(url, nombre, ancho, alto) {
  const left = Math.round(window.screenX + (window.outerWidth - ancho) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - alto) / 2);
  return window.open(
    url,
    nombre,
    `width=${ancho},height=${alto},left=${left},top=${top},scrollbars=yes,resizable=yes`
  );
}
