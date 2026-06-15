import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { obtenerConversaciones } from '../services/mensajeriaService.js';
import { useSesion } from '../hooks/useSesion.js';

const MensajeriaCtx = createContext({ totalSinLeer: 0, refrescar: () => {} });

export function MensajeriaProvider({ children }) {
  const { id_usuario } = useSesion();
  const [totalSinLeer, setTotalSinLeer] = useState(0);

  const refrescar = useCallback(async () => {
    if (!id_usuario) return;
    try {
      const convs = await obtenerConversaciones(id_usuario);
      setTotalSinLeer(convs.reduce((acc, c) => acc + (c.sin_leer || 0), 0));
    } catch { /* silencioso */ }
  }, [id_usuario]);

  useEffect(() => {
    refrescar();
    const alVolver = () => {
      if (document.visibilityState === 'visible') refrescar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [refrescar]);

  return (
    <MensajeriaCtx.Provider value={{ totalSinLeer, refrescar }}>
      {children}
    </MensajeriaCtx.Provider>
  );
}

export const useMensajeriaCtx = () => useContext(MensajeriaCtx);
