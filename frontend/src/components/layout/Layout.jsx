import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useLogout } from "../../hooks/useLogout.js";
import { LayoutDashboard, Calendar, Users, MessageSquare, Megaphone, Menu, Bell, ChevronDown, LogOut, CheckCheck, Trash2 } from "lucide-react";
import Modal from "../modal/Modal.jsx";
import logoCobach from "../../assets/img/logo-cobach.png";
import { ZONA } from "../../lib/fechas.js";
import { leerSesion } from "../../hooks/useSesion.js";
import { useNotificaciones } from "../../hooks/useNotificaciones.js";
import { refrescarSesion } from "../../services/authService.js";
import { useMensajeriaCtx } from "../../context/MensajeriaContext.jsx";
import styles from "./Layout.module.css";

const ROL_ETIQUETA = {
  superusuario: 'Superusuario',
  admin: 'Administrador',
  docente: 'Docente',
  alumno: 'Alumno',
};

const NAV = [
  { etiqueta: "Dashboard",  icono: LayoutDashboard, ruta: "/dashboard" },
  { etiqueta: "Calendario", icono: Calendar,         ruta: "/calendario" },
  { etiqueta: "Anuncios",   icono: Megaphone,        ruta: "/anuncios" },
  { etiqueta: "Mensajería", icono: MessageSquare,    ruta: "/mensajeria" },
  { etiqueta: "Usuarios",   icono: Users,            ruta: "/usuarios" },
];

export default function Layout() {
  const cerrarSesion = useLogout();
  const [sesion, setSesion] = useState(leerSesion);
  const { nombre, iniciales, rol, plantel, turno, tipoEmpleado, adscripcion } = sesion;
  const { totalSinLeer } = useMensajeriaCtx();

  useEffect(() => {
    refrescarSesion().then(() => setSesion(leerSesion()));
  }, []);

  const [esMovil, setEsMovil] = useState(
    () => window.matchMedia("(max-width: 920px)").matches
  );
  const [menuAbierto, setMenuAbierto] = useState(
    () => !window.matchMedia("(max-width: 920px)").matches
  );
  const [notifAbierto, setNotifAbierto] = useState(false);
  const { notificaciones, notifSinLeer, marcarTodasLeidas, limpiarNotificaciones } = useNotificaciones();
  const [cerrarSesionAbierto, setCerrarSesionAbierto] = useState(false);
  const [perfilAbierto, setPerfilAbierto] = useState(false);

  const notifRef = useRef(null);
  const perfilRef = useRef(null);

  useEffect(() => {
    const alClicar = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifAbierto(false);
      }
      if (perfilRef.current && !perfilRef.current.contains(e.target)) {
        setPerfilAbierto(false);
      }
    };
    document.addEventListener("mousedown", alClicar);
    return () => document.removeEventListener("mousedown", alClicar);
  }, []);

  useEffect(() => {
    const consulta = window.matchMedia("(max-width: 920px)");
    const alCambiar = (e) => {
      setEsMovil(e.matches);
      setMenuAbierto(!e.matches);
    };
    consulta.addEventListener("change", alCambiar);
    return () => consulta.removeEventListener("change", alCambiar);
  }, []);

  useEffect(() => {
    if (!esMovil || !notifAbierto) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [esMovil, notifAbierto]);

  const fechaLarga = new Intl.DateTimeFormat("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: ZONA,
  }).format(new Date());

  const horaActual = new Date().toLocaleTimeString("es-MX", {
    timeZone: ZONA, hour: "2-digit", minute: "2-digit",
  });

  const anioActual = new Date().getFullYear();
  const ciclo = new Date().getMonth() >= 7
    ? `${anioActual}–${anioActual + 1}`
    : `${anioActual - 1}–${anioActual}`;

  const cerrarMenuMovil = () => {
    if (esMovil) setMenuAbierto(false);
  };


  return (
    <div
      className={`${styles["aplicacion"]} ${
        menuAbierto ? "" : styles["aplicacion--compacto"]
      }`}
    >
      {menuAbierto && (
        <div
          className={styles["respaldo"]}
          onClick={() => setMenuAbierto(false)}
          aria-hidden="true"
        />
      )}

      <aside className={styles["barra-lateral"]}>
        <div className={styles["barra-lateral__marca"]}>
          <img src={logoCobach} alt="Logo de Cobach" width="155" height="75" />
        </div>

        <nav className={styles["navegacion"]} aria-label="Navegación principal">
          {(rol === 'admin' ? NAV.filter(item => item.ruta !== '/usuarios') : NAV).map(({ etiqueta, icono: Icono, ruta }) => (
            <NavLink
              key={ruta}
              to={ruta}
              onClick={cerrarMenuMovil}
              className={({ isActive }) =>
                `${styles["navegacion__opcion"]} ${
                  isActive ? styles["navegacion__opcion--activa"] : ""
                }`
              }
            >
              <Icono size={18} />
              {etiqueta}
              {etiqueta === "Mensajería" && totalSinLeer > 0 && (
                <span className={styles["navegacion__badge"]}>{totalSinLeer}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className={styles["barra-lateral__pie"]}>
          <div className={styles["sesion"]}>
            <span className={styles["sesion__punto"]} aria-hidden="true" />
            <div>
              <div className={styles["sesion__titulo"]}>Sesión activa</div>
              <div className={styles["sesion__subtitulo"]}>
                Último acceso:
                <br />
                {fechaLarga}, {horaActual}
              </div>
            </div>
          </div>

          <button
            type="button"
            className={styles["cerrar-sesion"]}
            onClick={() => setCerrarSesionAbierto(true)}
          >
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className={styles["principal"]}>
        <header className={styles["barra-superior"]}>
          <button
            type="button"
            className={styles["barra-superior__menu"]}
            onClick={() => setMenuAbierto((v) => !v)}
            aria-label={menuAbierto ? "Ocultar menú" : "Mostrar menú"}
          >
            <Menu size={20} />
          </button>

          <div className={styles["barra-superior__titulo"]}>
            <h1>Agenda Escolar Digital</h1>
            <p>Colegio de Bachilleres de Chiapas</p>
          </div>

          <div className={styles["barra-superior__derecha"]}>
            <div className={styles["notificaciones"]} ref={notifRef}>
              <button
                type="button"
                className={styles["notificaciones__boton"]}
                onClick={() => setNotifAbierto((v) => !v)}
                aria-label="Notificaciones"
              >
                <Bell size={20} />
                {notifSinLeer > 0 && (
                  <span className={styles["notificaciones__contador"]}>
                    {notifSinLeer}
                  </span>
                )}
              </button>

              {notifAbierto && (
                <>
                  <div
                    className={styles["respaldo-notif"]}
                    onClick={() => setNotifAbierto(false)}
                    aria-hidden="true"
                  />
                  <div className={styles["panel-notif"]}>
                    <div className={styles["panel-notif__cabecera"]}>
                      <span className={styles["panel-notif__titulo"]}>
                        Notificaciones
                      </span>
                      <span className="etiqueta etiqueta--azul">
                        {notifSinLeer} nuevas
                      </span>
                    </div>

                    {notificaciones.length > 0 && (
                      <div className={styles["panel-notif__acciones"]}>
                        <button
                          type="button"
                          className={styles["panel-notif__accion"]}
                          onClick={marcarTodasLeidas}
                          disabled={notifSinLeer === 0}
                        >
                          <CheckCheck size={14} />
                          Marcar como leído
                        </button>
                        <button
                          type="button"
                          className={`${styles["panel-notif__accion"]} ${styles["panel-notif__accion--peligro"]}`}
                          onClick={limpiarNotificaciones}
                        >
                          <Trash2 size={14} />
                          Limpiar todo
                        </button>
                      </div>
                    )}

                    <div className={styles["panel-notif__lista"]}>
                      {notificaciones.length === 0 ? (
                        <p className={styles["panel-notif__vacio"]}>
                          No tienes notificaciones.
                        </p>
                      ) : (
                        notificaciones.map(({ id, icono: Icono, color, titulo, subtitulo, sinLeer }) => (
                          <div
                            key={id}
                            className={`${styles["notif-fila"]} ${
                              sinLeer ? styles["notif-fila--sin-leer"] : ""
                            }`}
                          >
                            <span className={`${styles["notif-fila__icono"]} ${styles[`notif-fila__icono--${color}`]}`}>
                              <Icono size={15} />
                            </span>
                            <div className={styles["notif-fila__copia"]}>
                              <p className={styles["notif-fila__titulo"]}>{titulo}</p>
                              <span className={styles["notif-fila__subtitulo"]}>
                                {subtitulo}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <span className={styles["barra-superior__divisor"]} aria-hidden="true" />

            <div className={styles["plantel"]}>
              <div>
                <small>{tipoEmpleado === 'Administrativo' ? 'Departamento' : 'Plantel'}</small>
                <strong>{adscripcion || (plantel?.nombre ?? (rol === 'superusuario' ? 'Todos los planteles' : 'Sin plantel'))}</strong>
              </div>
            </div>

            <div className={styles["menu-perfil"]} ref={perfilRef}>
              <button
                type="button"
                className={styles["usuario"]}
                onClick={() => setPerfilAbierto((v) => !v)}
                aria-expanded={perfilAbierto}
              >
                <span className={styles["usuario__avatar"]}>{iniciales || 'US'}</span>
                <div className={styles["usuario__info"]}>
                  <strong>{nombre || 'Usuario'}</strong>
                  <span>{tipoEmpleado || ROL_ETIQUETA[rol] || 'Usuario'}</span>
                </div>
                <ChevronDown size={14} />
              </button>

              {perfilAbierto && (
                <div className={styles["menu-perfil__panel"]}>
                  <div className={styles["menu-perfil__cab"]}>
                    <span className={styles["usuario__avatar"]}>{iniciales || 'US'}</span>
                    <div>
                      <div className={styles["menu-perfil__nombre"]}>{nombre || 'Usuario'}</div>
                      <div className={styles["menu-perfil__rol"]}>{tipoEmpleado || ROL_ETIQUETA[rol] || 'Usuario'}</div>
                    </div>
                  </div>
                  <ul className={styles["menu-perfil__datos"]}>
                    <li>
                      <span>{tipoEmpleado === 'Administrativo' ? 'Departamento' : 'Plantel'}</span>
                      <strong>{adscripcion || plantel?.nombre || '—'}</strong>
                    </li>
                    <li><span>Turno</span><strong>{turno?.nombre || '—'}</strong></li>
                    <li><span>Ciclo escolar</span><strong>{ciclo}</strong></li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className={styles["contenido"]}>
          <Outlet />
        </div>
      </main>

      <Modal
        abierto={cerrarSesionAbierto}
        titulo="Cerrar sesión"
        onCerrar={() => setCerrarSesionAbierto(false)}
        pie={
          <>
            <button
              type="button"
              className="boton boton--fantasma"
              onClick={() => setCerrarSesionAbierto(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="boton boton--peligro"
              onClick={() => {
                setCerrarSesionAbierto(false);
                cerrarSesion();
              }}
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </>
        }
      >
        <p className={styles["confirmacion"]}>
          ¿Estás seguro de que deseas cerrar sesión? Tendrás que iniciar sesión
          nuevamente para volver a entrar.
        </p>
      </Modal>
    </div>
  );
}
