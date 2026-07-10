import { useState, useEffect, useCallback } from 'react';
import {
  obtenerConversaciones,
  obtenerMensajes,
  enviarMensaje as apiEnviar,
  marcarLeido,
} from '../services/mensajeriaService.js';

export function useMensajeria(idUsuario, onLeido) {
  const [conversaciones, setConversaciones] = useState([]);
  const [idConvActiva, setIdConvActiva]     = useState(null);
  const [mensajes, setMensajes]             = useState([]);
  const [cargandoConvs, setCargandoConvs]   = useState(true);
  const [cargandoMsgs, setCargandoMsgs]     = useState(false);
  const [error, setError]                   = useState(null);

  const cargarConversaciones = useCallback(async () => {
    if (!idUsuario) return;
    try {
      const data = await obtenerConversaciones(idUsuario);
      setConversaciones(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargandoConvs(false);
    }
  }, [idUsuario]);

  // Carga inicial
  useEffect(() => {
    cargarConversaciones();
  }, [cargarConversaciones]);

  // Recarga al volver a la pestaña — cero costo cuando la pestaña está oculta
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible') cargarConversaciones();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [cargarConversaciones]);

  const cargarMensajes = useCallback(async (idConv) => {
    if (!idConv || !idUsuario) return;
    setCargandoMsgs(true);
    try {
      const data = await obtenerMensajes(idUsuario, idConv);
      setMensajes(data);
      await marcarLeido(idUsuario, idConv);
      setConversaciones((prev) =>
        prev.map((c) => (c.id === idConv ? { ...c, sin_leer: 0 } : c))
      );
      onLeido?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setCargandoMsgs(false);
    }
  }, [idUsuario, onLeido]);

  const seleccionarConversacion = useCallback((idConv) => {
    setIdConvActiva(idConv);
    setMensajes([]);
    cargarMensajes(idConv);
  }, [cargarMensajes]);

  const recargarMensajes = useCallback(() => {
    if (idConvActiva) cargarMensajes(idConvActiva);
  }, [idConvActiva, cargarMensajes]);

  const enviarMensaje = useCallback(async (texto, metadatos = null) => {
    if (!idConvActiva || !texto.trim()) return;
    try {
      await apiEnviar(idUsuario, idConvActiva, texto.trim(), metadatos);
      await cargarMensajes(idConvActiva);
      await cargarConversaciones();
    } catch (e) {
      setError(e.message);
    }
  }, [idConvActiva, idUsuario, cargarMensajes, cargarConversaciones]);

  const totalSinLeer = conversaciones.reduce((acc, c) => acc + (c.sin_leer || 0), 0);

  return {
    conversaciones,
    idConvActiva,
    mensajes,
    cargandoConvs,
    cargandoMsgs,
    error,
    totalSinLeer,
    seleccionarConversacion,
    enviarMensaje,
    recargarMensajes,
    recargarConversaciones: cargarConversaciones,
  };
}
