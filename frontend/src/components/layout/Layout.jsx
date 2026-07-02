import { useEffect, useState } from "react";
import { LayoutDashboard, Calendar, Users, MessageSquare, Megaphone } from "lucide-react";
import { leerSesion } from "../../hooks/useSesion.js";
import { refrescarSesion } from "../../services/authService.js";
import { useMensajeriaCtx } from "../../context/MensajeriaContext.jsx";
import LayoutBase from "./LayoutBase.jsx";
import { ROL_ETIQUETA, cicloEscolar } from "./layoutUtils.js";
import styles from "./Layout.module.css";

const NAV = [
  { etiqueta: "Dashboard",  icono: LayoutDashboard, ruta: "/dashboard" },
  { etiqueta: "Calendario", icono: Calendar,         ruta: "/calendario" },
  { etiqueta: "Anuncios",   icono: Megaphone,        ruta: "/anuncios" },
  { etiqueta: "Mensajería", icono: MessageSquare,    ruta: "/mensajeria" },
  { etiqueta: "Usuarios",   icono: Users,            ruta: "/usuarios" },
];

// Rutas del menú que cada rol NO puede ver.
const RUTAS_OCULTAS = {
  admin: ['/usuarios'],
  colaborador: ['/usuarios', '/mensajeria'],
};

// Layout para admin, superusuario y colaborador.
export default function Layout() {
  const [sesion, setSesion] = useState(leerSesion);
  const { nombre, iniciales, rol, plantel, turno, tipoEmpleado, adscripcion } = sesion;
  const { totalSinLeer } = useMensajeriaCtx();

  useEffect(() => {
    refrescarSesion().then(() => setSesion(leerSesion()));
  }, []);

  const ocultas = RUTAS_OCULTAS[rol] || [];
  const nav = NAV.filter(item => !ocultas.includes(item.ruta))
    .map(item => ({ ...item, badge: item.etiqueta === 'Mensajería' ? totalSinLeer : 0 }));

  const labelPlantel = plantel?.nombre ? 'Plantel' : (tipoEmpleado === 'Administrativo' ? 'Departamento' : 'Plantel');
  const valorPlantel = rol === 'superusuario'
    ? 'Todos los planteles'
    : (plantel?.nombre || adscripcion || 'Sin plantel');

  const perfilContenido = (
    <ul className={styles["menu-perfil__datos"]}>
      <li>
        <span>{plantel?.nombre ? 'Plantel' : (tipoEmpleado === 'Administrativo' ? 'Departamento' : 'Plantel')}</span>
        <strong>
          {rol === 'superusuario'
            ? 'Todos los planteles'
            : (plantel?.nombre || adscripcion || '—')}
        </strong>
      </li>
      <li><span>Turno</span><strong>{turno?.nombre || '—'}</strong></li>
      <li><span>Ciclo escolar</span><strong>{cicloEscolar()}</strong></li>
    </ul>
  );

  return (
    <LayoutBase
      usuario={{
        nombre,
        iniciales,
        rolLabel: rol === 'colaborador'
          ? ROL_ETIQUETA.colaborador
          : (tipoEmpleado || ROL_ETIQUETA[rol] || 'Usuario'),
      }}
      nav={nav}
      plantelHeader={{ label: labelPlantel, valor: valorPlantel, conChevron: false }}
      perfilContenido={perfilContenido}
    />
  );
}
