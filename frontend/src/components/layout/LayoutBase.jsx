import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Menu, ChevronDown, LogOut } from "lucide-react";
import { useLogout } from "../../hooks/useLogout.js";
import { useNotificaciones } from "../../hooks/useNotificaciones.js";
import { usePreferencia } from "../../hooks/usePreferencia.js";
import Modal from "../modal/Modal.jsx";
import NotificacionesPanel from "./NotificacionesPanel.jsx";
import logoCobach from "../../assets/img/logo-cobach.png";
import { ZONA } from "../../lib/fechas.js";
import { abreviarAdscripcion } from "./layoutUtils.js";
import styles from "./Layout.module.css";

// Cáscara común a todos los layouts (admin, alumno/tutor, docente).
// Concentra la maquinaria responsiva, las notificaciones y el modal de cerrar
// sesión; cada rol aporta su configuración vía props/slots.
//
// Props:
//   usuario          { nombre, iniciales, rolLabel }
//   nav              [{ etiqueta, icono, ruta, badge }]  (badge ya resuelto a número)
//   plantelHeader    { label, valor, conChevron }
//   perfilContenido  ReactNode — contenido bajo la cabecera del panel de perfil
//   perfilDesplegable boolean opcional (default true) — false oculta el desplegable de perfil (ej. rol visitante)
//   sidebarExtra     ReactNode opcional — encima de "Sesión activa"
//   extraModales     ReactNode opcional — modales adicionales del rol
export default function LayoutBase({
  usuario,
  nav,
  plantelHeader,
  perfilContenido,
  perfilDesplegable = true,
  mostrarNotificaciones = true,
  sidebarExtra,
  extraModales,
  sesionAnonima = false,
}) {
  const cerrarSesion = useLogout();
  const { nombre, iniciales, rolLabel } = usuario;

  const textoSalir = sesionAnonima ? "Salir" : "Cerrar sesión";
  const mensajeSalir = sesionAnonima
    ? "¿Deseas salir del calendario? Volverás a la pantalla de inicio."
    : "¿Estás seguro de que deseas cerrar sesión? Tendrás que iniciar sesión nuevamente para volver a entrar.";

  const [esMovil, setEsMovil] = useState(
    () => window.matchMedia("(max-width: 920px)").matches
  );
  const [menuPref, setMenuPref] = usePreferencia("layout:menuAbierto", true);
  const [menuAbierto, setMenuAbierto] = useState(
    () => (window.matchMedia("(max-width: 920px)").matches ? false : menuPref)
  );
  const [menuPeek, setMenuPeek] = useState(false);
  const [notifAbierto, setNotifAbierto] = useState(false);
  const { notificaciones, notifSinLeer, marcarTodasLeidas, marcarLeida, limpiarNotificaciones } = useNotificaciones();
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
      setMenuPeek(false);
      setMenuAbierto(e.matches ? false : menuPref);
    };
    consulta.addEventListener("change", alCambiar);
    return () => consulta.removeEventListener("change", alCambiar);
  }, [menuPref]);

  const alternarMenu = () => {
    setMenuPeek(false);
    setMenuAbierto((v) => {
      const nuevo = !v;
      if (!esMovil) setMenuPref(nuevo);
      return nuevo;
    });
  };

  const alNavegar = () => {
    cerrarMenuMovil();
    setMenuPeek(false);
  };

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

  const cerrarMenuMovil = () => {
    if (esMovil) setMenuAbierto(false);
  };

  return (
    <div
      className={`${styles["aplicacion"]} ${
        menuAbierto ? "" : styles["aplicacion--compacto"]
      } ${menuPeek ? styles["aplicacion--peek"] : ""}`}
    >
      {menuAbierto && (
        <div
          className={styles["respaldo"]}
          onClick={() => setMenuAbierto(false)}
          aria-hidden="true"
        />
      )}

      {!esMovil && !menuAbierto && (
        <div
          className={styles["zona-peek"]}
          onMouseEnter={() => setMenuPeek(true)}
          aria-hidden="true"
        />
      )}

      <aside
        className={styles["barra-lateral"]}
        onMouseLeave={() => setMenuPeek(false)}
      >
        <div className={styles["barra-lateral__marca"]}>
          <img src={logoCobach} alt="Logo de Cobach" width="155" height="75" onClick={() => window.location.href = '/'}/>
        </div>

        <nav className={styles["navegacion"]} aria-label="Navegación principal">
          {nav.map(({ etiqueta, icono: Icono, ruta, badge }) => (
            <NavLink
              key={ruta}
              to={ruta}
              onClick={alNavegar}
              className={({ isActive }) =>
                `${styles["navegacion__opcion"]} ${
                  isActive ? styles["navegacion__opcion--activa"] : ""
                }`
              }
            >
              <Icono size={18} />
              {etiqueta}
              {badge > 0 && (
                <span className={styles["navegacion__badge"]}>{badge}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className={styles["barra-lateral__pie"]}>
          {sidebarExtra}

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
            {textoSalir}
          </button>
        </div>
      </aside>

      <main className={styles["principal"]}>
        <header className={styles["barra-superior"]}>
          <button
            type="button"
            className={styles["barra-superior__menu"]}
            onClick={alternarMenu}
            aria-label={menuAbierto ? "Ocultar menú" : "Mostrar menú"}
          >
            <Menu size={20} />
          </button>

          <div className={styles["barra-superior__titulo"]}>
            <h1>Agenda Escolar Digital</h1>
            <p>Colegio de Bachilleres de Chiapas</p>
          </div>

          <div className={styles["barra-superior__derecha"]}>
            {mostrarNotificaciones && (
              <>
                <NotificacionesPanel
                  notifRef={notifRef}
                  abierto={notifAbierto}
                  onToggle={() => setNotifAbierto((v) => !v)}
                  onCerrar={() => setNotifAbierto(false)}
                  notificaciones={notificaciones}
                  notifSinLeer={notifSinLeer}
                  marcarTodasLeidas={marcarTodasLeidas}
                  marcarLeida={marcarLeida}
                  limpiarNotificaciones={limpiarNotificaciones}
                />

                <span className={styles["barra-superior__divisor"]} aria-hidden="true" />
              </>
            )}

            <div className={styles["plantel"]}>
              <div>
                <small>{plantelHeader.label}</small>
                <strong>
                  {esMovil
                    ? abreviarAdscripcion(plantelHeader.valor)
                    : plantelHeader.valor}
                </strong>
              </div>
              {plantelHeader.conChevron && <ChevronDown size={14} />}
            </div>

            <div className={styles["menu-perfil"]} ref={perfilRef}>
              {perfilDesplegable ? (
                <>
                  <button
                    type="button"
                    className={styles["usuario"]}
                    onClick={() => setPerfilAbierto((v) => !v)}
                    aria-expanded={perfilAbierto}
                  >
                    <span className={styles["usuario__avatar"]}>{iniciales || 'US'}</span>
                    <div className={styles["usuario__info"]}>
                      <small>{rolLabel}</small>
                      <strong>{nombre || 'Usuario'}</strong>
                    </div>
                    <ChevronDown size={14} />
                  </button>

                  {perfilAbierto && (
                    <div className={styles["menu-perfil__panel"]}>
                      <div className={styles["menu-perfil__cab"]}>
                        <span className={styles["usuario__avatar"]}>{iniciales || 'US'}</span>
                        <div>
                          <div className={styles["menu-perfil__nombre"]}>{nombre || 'Usuario'}</div>
                          <div className={styles["menu-perfil__rol"]}>{rolLabel}</div>
                        </div>
                      </div>
                      {perfilContenido}
                    </div>
                  )}
                </>
              ) : (
                <div className={styles["usuario"]}>
                  <span className={styles["usuario__avatar"]}>{iniciales || 'US'}</span>
                  <div className={styles["usuario__info"]}>
                    <small>{rolLabel}</small>
                    <strong>{nombre || 'Usuario'}</strong>
                  </div>
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
        titulo={textoSalir}
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
              {textoSalir}
            </button>
          </>
        }
      >
        <p className={styles["confirmacion"]}>
          {mensajeSalir}
        </p>
      </Modal>

      {extraModales}
    </div>
  );
}
