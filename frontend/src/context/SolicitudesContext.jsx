import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { listarSolicitudes } from '../services/solicitudesService.js';
import { useSesion } from '../hooks/useSesion.js';

// Contadores de solicitudes PENDIENTES para los badges del menú lateral:
// - pendientesPlantel: visualización + cambio de turno (las ven admin y superusuario)
// - pendientesAdmin:   solicitudes para ser administrador (solo las gestiona el superusuario)
const SolicitudesCtx = createContext({
  pendientesPlantel: 0,
  pendientesAdmin: 0,
  refrescar: () => {},
});

export function SolicitudesProvider({ children }) {
  const { rol } = useSesion();
  const [pendientes, setPendientes] = useState({ plantel: 0, admin: 0 });

  const refrescar = useCallback(async () => {
    if (rol !== 'admin' && rol !== 'superusuario') return;
    try {
      const dePlantel = await listarSolicitudes('pendiente', 'visualizacion,turno');
      const deAdmin = rol === 'superusuario'
        ? await listarSolicitudes('pendiente', 'admin')
        : [];
      setPendientes({ plantel: dePlantel.length, admin: deAdmin.length });
    } catch { /* silencioso */ }
  }, [rol]);

  useEffect(() => {
    refrescar();
    const alVolver = () => {
      if (document.visibilityState === 'visible') refrescar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [refrescar]);

  return (
    <SolicitudesCtx.Provider
      value={{ pendientesPlantel: pendientes.plantel, pendientesAdmin: pendientes.admin, refrescar }}
    >
      {children}
    </SolicitudesCtx.Provider>
  );
}

export const useSolicitudesCtx = () => useContext(SolicitudesCtx);