export function posicionDesplegable(controlRect, alto, ancho) {
  const top = controlRect.bottom + alto > window.innerHeight
    ? Math.max(8, controlRect.top - alto - 6)
    : controlRect.bottom + 6;
  return { left: Math.min(controlRect.left, window.innerWidth - ancho), top };
}
