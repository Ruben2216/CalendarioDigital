import { iniciales } from '../lib/texto.js';
import { formatoHoraISO } from '../lib/fechas.js';

const BACKEND =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : (import.meta.env.VITE_BACKEND_URL ?? '');

const extraHeaders = {};

function apiFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: { ...extraHeaders, ...(options.headers || {}) },
  });
}

const COLORES = ['azul', 'verde', 'naranja'];

export async function obtenerConversaciones(idUsuario) {
  const res = await apiFetch(`${BACKEND}/api/mensajeria/conversaciones/?id_usuario=${idUsuario}`);
  if (!res.ok) throw new Error('Error al cargar conversaciones');
  const data = await res.json();
  return data.map((c, i) => {
    const pA = c.participante_a ? { ...c.participante_a, iniciales: iniciales(c.participante_a.nombre) } : null;
    const pB = c.participante_b ? { ...c.participante_b, iniciales: iniciales(c.participante_b.nombre) } : null;
    const otro = c.otro_usuario ? { ...c.otro_usuario, iniciales: iniciales(c.otro_usuario.nombre) } : null;
    const nombreOtro = otro?.nombre ?? (pA && pB ? `${pA.nombre} ↔ ${pB.nombre}` : '—');
    const inicialesOtro = otro?.iniciales ?? (pA ? pA.iniciales : '?');
    return {
      id: c.id,
      es_participante: c.es_participante,
      otro_usuario: otro,
      participante_a: pA,
      participante_b: pB,
      sin_leer: c.sin_leer,
      iniciales: inicialesOtro,
      destinatario: nombreOtro,
      ubicacion: otro?.ubicacion ?? (pA && pB ? `${pA.ubicacion ?? pA.rol} · ${pB.ubicacion ?? pB.rol}` : ''),
      colorAvatar: COLORES[i % COLORES.length],
      mensajes: c.ultimo_mensaje
        ? [{
            id: `preview-${c.id}`,
            tipo: 'recibido',
            hora: formatoHoraISO(c.ultimo_mensaje.fecha),
            texto: c.ultimo_mensaje.texto,
          }]
        : [],
    };
  });
}

export async function obtenerMensajes(idUsuario, idConv) {
  const res = await apiFetch(
    `${BACKEND}/api/mensajeria/conversaciones/${idConv}/mensajes/?id_usuario=${idUsuario}`
  );
  if (!res.ok) throw new Error('Error al cargar mensajes');
  const data = await res.json();
  return data.map((m) => ({
    id: m.id,
    tipo: m.es_propio ? 'enviado' : 'recibido',
    remitenteId: m.remitente_id,
    hora: formatoHoraISO(m.fecha_envio),
    texto: m.texto,
    solicitud: m.metadatos ?? undefined,
  }));
}

export async function enviarMensaje(idUsuario, idConv, texto, metadatos = null) {
  const res = await apiFetch(`${BACKEND}/api/mensajeria/conversaciones/${idConv}/mensajes/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto, id_usuario: idUsuario, metadatos }),
  });
  if (!res.ok) throw new Error('Error al enviar mensaje');
  return res.json();
}

export async function marcarLeido(idUsuario, idConv) {
  await apiFetch(`${BACKEND}/api/mensajeria/conversaciones/${idConv}/leer/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_usuario: idUsuario }),
  });
}

export async function obtenerDocentes(idUsuario) {
  const res = await apiFetch(`${BACKEND}/api/mensajeria/docentes/?id_usuario=${idUsuario}`);
  if (!res.ok) throw new Error('Error al cargar docentes');
  return res.json();
}

export async function crearConversacion(idUsuario, idOtroUsuario) {
  const res = await apiFetch(`${BACKEND}/api/mensajeria/conversaciones/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_usuario: idUsuario, id_otro_usuario: idOtroUsuario }),
  });
  if (!res.ok) throw new Error('Error al crear conversación');
  return res.json();
}

export const obtenerOCrearConversacion = crearConversacion;

export async function listarAdminsSolicitud(idPlantel, turno) {
  const params = new URLSearchParams({ rol: 'admin' });
  if (idPlantel) params.set('plantel', idPlantel);
  if (turno)     params.set('turno', turno);
  const res = await apiFetch(`${BACKEND}/api/usuarios/?${params.toString()}`);
  if (!res.ok) throw new Error('Error al cargar administradores');
  return res.json();
}
