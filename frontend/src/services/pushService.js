import { getToken, onMessage } from "firebase/messaging";
import { messaging } from "./firebaseConfig";
import Swal from "sweetalert2";

const VAPID_KEY = import.meta.env.VITE_VAPID_KEY;
const BASE_URL =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : (import.meta.env.VITE_BACKEND_URL ?? '');

let _escuchandoPrimerPlano = false;

/**
 * Pide permiso, obtiene el token FCM y lo registra en el backend
 *
 * @param {{id_usuario:?number, rol:string, plantel_id:?number, plantel_nombre:?string}} usuarioActual
 */
export const inicializarNotificaciones = async (usuarioActual) => {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Permisos de notificación denegados.');
      return;
    }

    const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!currentToken) {
      console.log('No se pudo obtener el token FCM.');
      return;
    }

    await registrarDispositivo(currentToken, usuarioActual);
    escucharPrimerPlano();
  } catch (error) {
    console.error('Error al inicializar notificaciones:', error);
  }
};

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
      plantel_id: usuarioActual.plantel_id ?? null,
      plantel_nombre: usuarioActual.plantel_nombre ?? null,
    }),
  });

  if (!respuesta.ok) {
    console.error('Fallo al registrar el dispositivo:', respuesta.status);
    return;
  }
  const datos = await respuesta.json().catch(() => ({}));
  console.log('Dispositivo registrado. Temas:', datos.temas);
}

/**
 * Las notificaciones push NO se muestran solas mientras la app está abierta
 */
export function escucharPrimerPlano() {
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
