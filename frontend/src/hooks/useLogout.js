import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useSesion } from './useSesion.js';
import { obtenerTokenFCM } from '../services/pushService.js';
import { avisoCerrandoSesion } from '../lib/alertas.js';

const BACKEND =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : (import.meta.env.VITE_BACKEND_URL ?? '');

export function useLogout() {
  const navigate = useNavigate();
  const { id_usuario } = useSesion();

  return async function cerrarSesion() {
    avisoCerrandoSesion();
    const token_fcm = await obtenerTokenFCM().catch(() => null);
    try {
      await fetch(`${BACKEND}/api/auth/logout/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_usuario, token_fcm }),
      });
    } catch {
      // El cierre local procede aunque falle el backend
    }
    localStorage.removeItem('authToken');
    localStorage.removeItem('sesion');
    Swal.close();
    navigate('/login', { replace: true });
  };
}
