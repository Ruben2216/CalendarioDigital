const BACKEND =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000');

const COLORES = ['azul', 'verde', 'naranja'];

function horaDesde(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function inicialesDesde(nombre) {
  return (nombre || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export async function obtenerConversaciones(idUsuario) {
  const res = await fetch(`${BACKEND}/api/mensajeria/conversaciones/?id_usuario=${idUsuario}`);
  if (!res.ok) throw new Error('Error al cargar conversaciones');
  const data = await res.json();
  return data.map((c, i) => ({
    id: c.id,
    otro_usuario: { ...c.otro_usuario, iniciales: inicialesDesde(c.otro_usuario.nombre) },
    plantel: c.plantel,
    sin_leer: c.sin_leer,
    // compatibilidad con ConvLista
    iniciales: inicialesDesde(c.otro_usuario.nombre),
    destinatario: c.otro_usuario.nombre,
    colorAvatar: COLORES[i % COLORES.length],
    mensajes: c.ultimo_mensaje
      ? [{
          id: `preview-${c.id}`,
          tipo: 'recibido',
          hora: horaDesde(c.ultimo_mensaje.fecha),
          texto: c.ultimo_mensaje.texto,
        }]
      : [],
  }));
}

export async function obtenerMensajes(idUsuario, idConv) {
  const res = await fetch(
    `${BACKEND}/api/mensajeria/conversaciones/${idConv}/mensajes/?id_usuario=${idUsuario}`
  );
  if (!res.ok) throw new Error('Error al cargar mensajes');
  const data = await res.json();
  return data.map((m) => ({
    id: m.id,
    tipo: m.es_propio ? 'enviado' : 'recibido',
    hora: horaDesde(m.fecha_envio),
    texto: m.texto,
    solicitud: m.metadatos ?? undefined,
  }));
}

export async function enviarMensaje(idUsuario, idConv, texto, metadatos = null) {
  const res = await fetch(`${BACKEND}/api/mensajeria/conversaciones/${idConv}/mensajes/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto, id_usuario: idUsuario, metadatos }),
  });
  if (!res.ok) throw new Error('Error al enviar mensaje');
  return res.json();
}

export async function marcarLeido(idUsuario, idConv) {
  await fetch(`${BACKEND}/api/mensajeria/conversaciones/${idConv}/leer/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_usuario: idUsuario }),
  });
}

export async function obtenerDocentes(idUsuario) {
  const res = await fetch(`${BACKEND}/api/mensajeria/docentes/?id_usuario=${idUsuario}`);
  if (!res.ok) throw new Error('Error al cargar docentes');
  return res.json();
}

export async function crearConversacion(idUsuario, idOtroUsuario) {
  const res = await fetch(`${BACKEND}/api/mensajeria/conversaciones/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_usuario: idUsuario, id_otro_usuario: idOtroUsuario }),
  });
  if (!res.ok) throw new Error('Error al crear conversación');
  return res.json();
}

export const obtenerOCrearConversacion = crearConversacion;
