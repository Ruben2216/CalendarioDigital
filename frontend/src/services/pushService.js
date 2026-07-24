import { getToken, onMessage } from "firebase/messaging";
import { messagingPromise } from "./firebaseConfig";
import Swal from "sweetalert2";

const VAPID_KEY = import.meta.env.VITE_VAPID_KEY;
const BASE_URL =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : (import.meta.env.VITE_BACKEND_URL || '');

let _escuchandoPrimerPlano = false;
let _swRegistro = null;

async function _registrarSW() {
  if (_swRegistro) return _swRegistro;
  if (!('serviceWorker' in navigator)) return null;
  try {
    _swRegistro = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    return _swRegistro;
  } catch {
    return null;
  }
}

/**
 * Pide permiso, obtiene el token FCM y lo registra en el backend
 *
 * @param {{id_usuario:?number, rol:string, plantel_id:?number, plantel_nombre:?string}} usuarioActual
 */
export const inicializarNotificaciones = async (usuarioActual) => {
  try {
    const messaging = await messagingPromise;
    if (!messaging) {
      console.log('Notificaciones push no soportadas en este navegador/contexto.');
      return;
    }

    escucharPrimerPlano(messaging);

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Permisos de notificación denegados.');
      return;
    }

    await _registrarSW();

    let currentToken;
    try {
      currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
    } catch (e) {
      console.warn('Error al obtener token FCM:', e);
    }

    if (!currentToken) {
      console.log('No se pudo obtener el token FCM, se reintentará en segundo plano.');
      return;
    }

    try {
      await registrarDispositivo(currentToken, usuarioActual);
    } catch (e) {
      console.warn('Error al registrar dispositivo en backend:', e);
    }
  } catch (error) {
    console.error('Error al inicializar notificaciones:', error);
  }
};

export async function obtenerTokenFCM() {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return null;
    }
    const messaging = await messagingPromise;
    if (!messaging) return null;
    return await getToken(messaging, { vapidKey: VAPID_KEY });
  } catch {
    return null;
  }
}

async function registrarDispositivo(token, usuarioActual = {}) {
  const respuesta = await fetch(`${BASE_URL}/api/dispositivos/registrar/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'ngrok-skip-browser-warning': '1',
    },
    body: JSON.stringify({
      token_fcm: token,
      id_usuario: usuarioActual.id_usuario ?? null,
      rol: usuarioActual.rol ?? '',
      planteles: usuarioActual.planteles ?? [],
      plantel_id: usuarioActual.plantel_id ?? null,
      plantel_nombre: usuarioActual.plantel_nombre ?? null,
    }),
  });

  if (!respuesta.ok) {
    console.error('Fallo al registrar el dispositivo:', respuesta.status, 'en', BASE_URL);
    return;
  }
  const datos = await respuesta.json().catch(() => ({}));
  const temas = datos?.temas;
  if (temas) {
    console.log('Dispositivo registrado. Temas:', temas);
  } else {
    console.warn('Dispositivo registrado, pero no se recibieron temas en la respuesta.');
  }
}

/**
 * Las notificaciones push NO se muestran solas mientras la app está abierta
 */
export function escucharPrimerPlano(messaging) {
  if (_escuchandoPrimerPlano) return;
  _escuchandoPrimerPlano = true;

  onMessage(messaging, (payload) => {
    const titulo = payload?.data?.title || 'Nueva notificación';
    const cuerpo = payload?.data?.body || '';
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'info',
      title: titulo,
      text: cuerpo,
      showConfirmButton: false,
      timer: 6000,
      timerProgressBar: true,
      heightAuto: false,
      scrollbarPadding: false,
      backdrop: false,
    });
  });
}
