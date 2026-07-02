import { useEffect, useState } from "react";
import { urlAutorizacion, verificarVinculo, vincular, desvincular } from "../services/googleCalendarService.js";
import { abrirVentanaCentrada } from "../lib/ventana.js";
import { avisoExito, avisoError, confirmarAccion } from "../lib/alertas.js";

/* Vinculación de la cuenta con Google Calendar vía popup OAuth.
   calVinculado: null = verificando, false = no vinculado, { vinculado: true, email } = vinculado */
export function useGoogleCalendarSync({ activo, idUsuario }) {
  const [calVinculado, setCalVinculado] = useState(null);

  useEffect(() => {
    if (!activo || !idUsuario) return;
    verificarVinculo()
      .then((data) => setCalVinculado(data.vinculado ? data : false))
      .catch(() => setCalVinculado(false));
  }, [activo, idUsuario]);

  useEffect(() => {
    if (!activo || !idUsuario) return;
    const onMessage = async (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'google-calendar-code') return;
      const { code, error, redirect_uri } = event.data;
      if (error) { avisoError('Autorización rechazada por Google.'); return; }
      if (!code) return;
      try {
        const resultado = await vincular(code, redirect_uri);
        setCalVinculado({ vinculado: true, email: resultado.email ?? null });
        avisoExito('Google Calendar vinculado correctamente.');
      } catch (e) {
        avisoError(e.message || 'No se pudo vincular Google Calendar.');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [activo, idUsuario]);

  const abrirVinculacion = () => {
    const popup = abrirVentanaCentrada(urlAutorizacion(), 'google-calendar-vincular', 520, 620);
    if (!popup) avisoError('Permite ventanas emergentes para vincular Google Calendar.');
  };

  const desconectar = async () => {
    const emailMostrar = calVinculado?.email ? ` (${calVinculado.email})` : '';
    const result = await confirmarAccion({
      titulo: 'Desconectar Google Calendar',
      html: `Los eventos ya sincronizados permanecerán en tu Google Calendar${emailMostrar}.`,
      confirmar: 'Desconectar',
      peligro: true,
    });
    if (!result.isConfirmed) return;
    try {
      await desvincular();
      setCalVinculado(false);
      avisoExito('Google Calendar desconectado.');
    } catch {
      avisoError('No se pudo desconectar Google Calendar.');
    }
  };

  return { calVinculado, abrirVinculacion, desconectar };
}
