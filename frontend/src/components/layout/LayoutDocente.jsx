import { useState } from "react";
import { Home, Calendar, MessageSquare, ShieldCheck, Megaphone } from "lucide-react";
import { useSesion } from "../../hooks/useSesion.js";
import { useAnunciosNoLeidos } from "../../hooks/useAnunciosNoLeidos.js";
import { useMensajeriaCtx } from "../../context/MensajeriaContext.jsx";
import SolicitudAdmin from "../solicitud-admin/SolicitudAdmin.jsx";
import EditorPlanteles from "./EditorPlanteles.jsx";
import LayoutBase from "./LayoutBase.jsx";
import { ROL_ETIQUETA, cicloEscolar } from "./layoutUtils.js";
import styles from "./Layout.module.css";

const NAV_DOCENTE_BASE = [
  { etiqueta: 'Inicio',     icono: Home,          ruta: '/docente/inicio' },
  { etiqueta: 'Calendario', icono: Calendar,      ruta: '/docente/calendario' },
  { etiqueta: 'Anuncios',   icono: Megaphone,     ruta: '/docente/anuncios', badgeAnuncios: true },
  { etiqueta: 'Foro',       icono: MessageSquare, ruta: '/docente/foro', badgeDinamico: true },
];

// Layout para docente.
export default function LayoutDocente() {
  const { nombre, iniciales, rol, planteles = [], tipoEmpleado, adscripcion } = useSesion();
  const anunciosNoLeidos = useAnunciosNoLeidos();
  const { totalSinLeer } = useMensajeriaCtx();
  const [solicitudAbierto, setSolicitudAbierto] = useState(false);

  // Agrupar por plantel (un docente puede tener Matutino+Vespertino en el mismo plantel)
  const plantelesAgrupados = Object.values(
    planteles.reduce((acc, up) => {
      const id = up.plantel.id;
      if (!acc[id]) acc[id] = { plantel: up.plantel, turnos: [] };
      acc[id].turnos.push(up.turno);
      return acc;
    }, {})
  );

  const plantelHeaderText =
    adscripcion ||
    (plantelesAgrupados.length === 1
      ? plantelesAgrupados[0].plantel.nombre
      : plantelesAgrupados.length > 1
      ? `${plantelesAgrupados.length} planteles`
      : rol === 'superusuario'
      ? 'Todos los planteles'
      : 'Sin plantel');

  const nav = NAV_DOCENTE_BASE.map(item => ({
    ...item,
    badge: item.badgeDinamico ? totalSinLeer : item.badgeAnuncios ? anunciosNoLeidos : 0,
  }));

  const sidebarExtra = (
    <button
      type="button"
      className="boton boton--primario"
      style={{ width: "100%", marginBottom: 10 }}
      onClick={() => setSolicitudAbierto(true)}
    >
      <ShieldCheck size={16} />
      Solicitar acceso admin
    </button>
  );

  const perfilContenido = (
    <>
      <EditorPlanteles plantelesAgrupados={plantelesAgrupados} />
      <ul className={styles["menu-perfil__datos"]}>
        <li><span>Ciclo escolar</span><strong>{cicloEscolar()}</strong></li>
      </ul>
    </>
  );

  return (
    <LayoutBase
      usuario={{ nombre, iniciales, rolLabel: tipoEmpleado || ROL_ETIQUETA[rol] || 'Usuario' }}
      nav={nav}
      plantelHeader={{
        label: tipoEmpleado === 'Administrativo' ? 'Departamento' : 'Adscripción',
        valor: plantelHeaderText,
        conChevron: true,
      }}
      sidebarExtra={sidebarExtra}
      perfilContenido={perfilContenido}
      extraModales={
        <SolicitudAdmin
          abierto={solicitudAbierto}
          onCerrar={() => setSolicitudAbierto(false)}
        />
      }
    />
  );
}
