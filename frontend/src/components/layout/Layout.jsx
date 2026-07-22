import { useEffect, useState } from "react";
import { LayoutDashboard, Calendar, Users, MessageSquare, Megaphone, Inbox } from "lucide-react";
import { leerSesion } from "../../hooks/useSesion.js";
import { refrescarSesion } from "../../services/authService.js";
import { useMensajeriaCtx } from "../../context/MensajeriaContext.jsx";
import { useSolicitudesCtx } from "../../context/SolicitudesContext.jsx";
import LayoutBase from "./LayoutBase.jsx";
import { ROL_ETIQUETA, cicloEscolar, etiquetaLugar, valorLugar } from "./layoutUtils.js";
import styles from "./Layout.module.css";

const NAV = [
  { etiqueta: "Dashboard",   icono: LayoutDashboard, ruta: "/dashboard" },
  { etiqueta: "Calendario",  icono: Calendar,         ruta: "/calendario" },
  { etiqueta: "Anuncios",    icono: Megaphone,        ruta: "/anuncios" },
  { etiqueta: "Mensajería",  icono: MessageSquare,    ruta: "/mensajeria" },
  { etiqueta: "Solicitudes", icono: Inbox,            ruta: "/solicitudes" },
  { etiqueta: "Usuarios",    icono: Users,            ruta: "/usuarios" },
];

// Rutas del menú que cada rol NO puede ver.
const RUTAS_OCULTAS = {
  admin: ['/usuarios'],
  colaborador: ['/usuarios', '/mensajeria', '/solicitudes'],
  director_departamento: ['/usuarios'],
  subdirector_departamento: ['/usuarios'],
};

// Layout para admin, superusuario, colaborador, director y subdirector de departamento.
export default function Layout() {
  const [sesion, setSesion] = useState(leerSesion);
  const { nombre, iniciales, rol, plantel, turno, tipoEmpleado, adscripcion, agrupacion } = sesion;
  const { totalSinLeer } = useMensajeriaCtx();
  const { pendientesPlantel, pendientesAdmin } = useSolicitudesCtx();

  useEffect(() => {
    refrescarSesion().then(() => setSesion(leerSesion()));
  }, []);

  const esAgrupacionRol = rol === 'director_departamento' || rol === 'subdirector_departamento';
  const nombreAgrupacion = agrupacion?.nombre || null;

  const BADGES = {
    'Mensajería': totalSinLeer,
    'Solicitudes': pendientesPlantel,
    'Usuarios': pendientesAdmin,
  };

  const ocultas = RUTAS_OCULTAS[rol] || [];
  const nav = NAV.filter(item => !ocultas.includes(item.ruta))
    .map(item => ({ ...item, badge: BADGES[item.etiqueta] || 0 }));

  const nombrePlantel = plantel?.nombre || null;
  const valorPlantel = valorLugar({ rol, nombrePlantel, adscripcion, agrupacion: nombreAgrupacion });
  const labelPlantel = etiquetaLugar({
    rol,
    tipoEmpleado,
    tienePlantel: !!nombrePlantel,
    nombreLugar: nombrePlantel || adscripcion,
  });

  const perfilContenido = (
    <ul className={styles["menu-perfil__datos"]}>
      <li>
        <span>{labelPlantel}</span>
        <strong>{valorPlantel}</strong>
      </li>
      <li><span>Turno</span><strong>{esAgrupacionRol ? '—' : (turno?.nombre || '—')}</strong></li>
      <li><span>Ciclo escolar</span><strong>{cicloEscolar()}</strong></li>
    </ul>
  );

  return (
    <LayoutBase
      usuario={{
        nombre,
        iniciales,
        rolLabel: ROL_ETIQUETA[rol] || tipoEmpleado || 'Usuario',
      }}
      nav={nav}
      plantelHeader={{ label: labelPlantel, valor: valorPlantel, conChevron: false }}
      perfilContenido={perfilContenido}
    />
  );
}
