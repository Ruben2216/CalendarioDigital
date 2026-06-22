import { useNavigate } from 'react-router-dom';
import { useSesion } from './useSesion.js';

const BACKEND =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : (import.meta.env.VITE_BACKEND_URL ?? '');

export function useLogout() {
  const navigate = useNavigate();
  const { id_usuario } = useSesion();

  return async function cerrarSesion() {
    try {
      await fetch(`${BACKEND}/api/auth/logout/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_usuario }),
      });
    } catch {
      // El cierre local procede aunque falle el backend
    }
    localStorage.removeItem('authToken');
    localStorage.removeItem('sesion');
    navigate('/login', { replace: true });
  };
}
