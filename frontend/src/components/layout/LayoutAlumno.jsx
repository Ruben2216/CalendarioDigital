import { Home, Calendar, Megaphone } from "lucide-react";
import { useSesion } from "../../hooks/useSesion.js";
import { useAnunciosNoLeidos } from "../../hooks/useAnunciosNoLeidos.js";
import LayoutBase from "./LayoutBase.jsx";
import { ROL_ETIQUETA, cicloEscolar } from "./layoutUtils.js";
import styles from "./Layout.module.css";

const NAV_ALUMNO = [
  { etiqueta: 'Inicio', icono: Home, ruta: '/alumno/inicio' },
  { etiqueta: 'Calendario', icono: Calendar, ruta: '/alumno/calendario' },
  { etiqueta: 'Anuncios', icono: Megaphone, ruta: '/alumno/anuncios', badgeAnuncios: true },
];

const NAV_TUTOR = [
  { etiqueta: 'Calendario', icono: Calendar, ruta: '/tutor/calendario' },
];

// Layout para alumno y padre/tutor.
export default function LayoutAlumno() {
  const { nombre, iniciales, rol, plantel, turno } = useSesion();
  const anunciosNoLeidos = useAnunciosNoLeidos();

  const nav = (rol === 'tutor' ? NAV_TUTOR : NAV_ALUMNO).map(item => ({
    ...item,
    badge: item.badgeAnuncios ? anunciosNoLeidos : 0,
  }));

  const valorPlantel = plantel?.nombre ?? (rol === 'superusuario'
    ? 'Todos los planteles'
    : rol === 'tutor' ? 'Acceso general' : 'Sin plantel');

  const perfilContenido = (
    <ul className={styles["menu-perfil__datos"]}>
      <li><span>Plantel</span><strong>{plantel?.nombre || '—'}</strong></li>
      <li><span>Turno</span><strong>{turno?.nombre || '—'}</strong></li>
      <li><span>Ciclo escolar</span><strong>{cicloEscolar()}</strong></li>
    </ul>
  );

  return (
    <LayoutBase
      usuario={{ nombre, iniciales, rolLabel: ROL_ETIQUETA[rol] ?? 'Usuario' }}
      nav={nav}
      plantelHeader={{ label: 'Plantel', valor: valorPlantel, conChevron: false }}
      perfilContenido={perfilContenido}
      perfilDesplegable={rol !== 'tutor'}
      mostrarNotificaciones={rol !== 'tutor'}
      sesionAnonima={rol === 'tutor'}
    />
  );
}
