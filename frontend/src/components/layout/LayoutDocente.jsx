import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useLogout } from "../../hooks/useLogout.js";
import { Home, Calendar, MessageSquare, Menu, Bell, ChevronDown, LogOut, CheckCheck, Trash2, ShieldCheck, Megaphone, Pencil, X, Plus } from "lucide-react";
import { guardarConfiguracionPlanteles, obtenerPlanteles } from "../../services/authService.js";
import Modal from "../modal/Modal.jsx";
import SolicitudAdmin from "../solicitud-admin/SolicitudAdmin.jsx";
import logoCobach from "../../assets/img/logo-cobach.png";
import { NOTIFICACIONES } from "../../data/avisos.js";
import { ZONA } from "../../lib/fechas.js";
import { useSesion } from "../../hooks/useSesion.js";
import { useMensajeriaCtx } from "../../context/MensajeriaContext.jsx";
import styles from "./Layout.module.css";

const TURNOS_FIJOS = ['Matutino', 'Vespertino', 'Mixto'];

const ROL_ETIQUETA = {
  superusuario: 'Superusuario',
  admin: 'Administrador',
  docente: 'Docente',
  alumno: 'Alumno',
};

const NAV_DOCENTE_BASE = [
  { etiqueta: 'Inicio',     icono: Home,          ruta: '/docente/inicio' },
  { etiqueta: 'Calendario', icono: Calendar,      ruta: '/docente/calendario' },
  { etiqueta: 'Anuncios',   icono: Megaphone,     ruta: '/docente/anuncios' },
  { etiqueta: 'Foro',       icono: MessageSquare, ruta: '/docente/foro', badgeDinamico: true },
];

export default function LayoutDocente() {
  const cerrarSesion = useLogout();
  const { nombre, iniciales, rol, planteles = [], tipoEmpleado, adscripcion } = useSesion();

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
  const { totalSinLeer } = useMensajeriaCtx();

  const [esMovil, setEsMovil] = useState(
    () => window.matchMedia("(max-width: 920px)").matches
  );
  const [menuAbierto, setMenuAbierto] = useState(
    () => !window.matchMedia("(max-width: 920px)").matches
  );
  const [notifAbierto, setNotifAbierto] = useState(false);
  const [notificaciones, setNotificaciones] = useState(NOTIFICACIONES);
  const [cerrarSesionAbierto, setCerrarSesionAbierto] = useState(false);
  const [solicitudAbierto, setSolicitudAbierto] = useState(false);
  const [perfilAbierto, setPerfilAbierto] = useState(false);

  // --- edit planteles ---
  const [editando, setEditando] = useState(false);
  const [editState, setEditState] = useState([]);      // [{ plantel:{id,nombre}, turnos: Set<string> }]
  const [buscando, setBuscando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [cargandoOpciones, setCargandoOpciones] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorEdit, setErrorEdit] = useState('');
  const plantelesCache = useRef(null);                 // 338 planteles, se carga una sola vez

  const notifRef = useRef(null);
  const perfilRef = useRef(null);

  useEffect(() => {
    const alClicar = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifAbierto(false);
      }
      if (perfilRef.current && !perfilRef.current.contains(e.target)) {
        setPerfilAbierto(false);
        setEditando(false); setEditState([]); setBuscando(false); setBusqueda(''); setErrorEdit('');
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

  // ---- handlers de edición de planteles ----

  const resetEdit = () => {
    setEditando(false); setEditState([]); setBuscando(false);
    setBusqueda(''); setErrorEdit('');
  };

  const entrarEdit = () => {
    setEditState(plantelesAgrupados.map(({ plantel, turnos }) => ({
      plantel,
      turnos: new Set(turnos.map(t => t.nombre)),
    })));
    setErrorEdit('');
    setEditando(true);
    if (!plantelesCache.current) {
      setCargandoOpciones(true);
      obtenerPlanteles()
        .then(data => { plantelesCache.current = data; })
        .catch(() => {})
        .finally(() => setCargandoOpciones(false));
    }
  };

  const quitarPlantel = (id) =>
    setEditState(prev => prev.filter(e => e.plantel.id !== id));

  // Radio: seleccionar un turno deselecciona los demás (Matutino/Vespertino/Mixto son excluyentes)
  const toggleTurno = (plantelId, tn) =>
    setEditState(prev => prev.map(e =>
      e.plantel.id !== plantelId ? e : { ...e, turnos: new Set([tn]) }
    ));

  const agregarPlantel = (p) => {
    if (editState.some(e => e.plantel.id === p.id)) return;
    setEditState(prev => [...prev, { plantel: { id: p.id, nombre: p.nombre }, turnos: new Set(['Matutino']) }]);
    setBusqueda(''); setBuscando(false);
  };

  const guardarCambios = async () => {
    if (editState.length === 0) { setErrorEdit('Agrega al menos un plantel.'); return; }
    setGuardando(true); setErrorEdit('');
    const selecciones = {};
    editState.forEach(({ plantel, turnos }) => {
      selecciones[plantel.id] = {
        matutino: turnos.has('Matutino'),
        vespertino: turnos.has('Vespertino'),
        mixto: turnos.has('Mixto'),
      };
    });
    const res = await guardarConfiguracionPlanteles(selecciones);
    setGuardando(false);
    if (!res.exito) { setErrorEdit(res.error || 'Error al guardar.'); return; }
    const sesionActual = JSON.parse(localStorage.getItem('sesion') || '{}');
    localStorage.setItem('sesion', JSON.stringify({ ...sesionActual, planteles: res.datos.planteles ?? [] }));
    resetEdit();
  };

  // ---- fin handlers ----

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

  const notifSinLeer = notificaciones.filter((n) => n.sinLeer).length;
  const marcarTodasLeidas = () =>
    setNotificaciones((prev) => prev.map((n) => ({ ...n, sinLeer: false })));
  const limpiarNotificaciones = () => setNotificaciones([]);

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
          {NAV_DOCENTE_BASE.map(({ etiqueta, icono: Icono, ruta, badgeDinamico }) => {
            const badge = badgeDinamico ? totalSinLeer : 0;
            return (
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
              {badge > 0 && (
                <span className={styles["navegacion__badge"]}>{badge}</span>
              )}
            </NavLink>
            );
          })}
        </nav>

        <div className={styles["barra-lateral__pie"]}>
          <button
            type="button"
            className="boton boton--primario"
            style={{ width: "100%", marginBottom: 10 }}
            onClick={() => setSolicitudAbierto(true)}
          >
            <ShieldCheck size={16} />
            Solicitar acceso admin
          </button>

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
                <small>{tipoEmpleado === 'Administrativo' ? 'Departamento' : 'Adscripción'}</small>
                <strong>{plantelHeaderText}</strong>
              </div>
              <ChevronDown size={14} />
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

                  <div className={styles["menu-perfil__planteles"]}>
                    {/* cabecera de sección */}
                    <div className={styles["menu-perfil__planteles-header"]}>
                      <span className={styles["menu-perfil__planteles-label"]}>Planteles asignados</span>
                      {!editando
                        ? <button type="button" className={styles["menu-perfil__edit-btn"]} onClick={entrarEdit}><Pencil size={11} />Editar</button>
                        : <button type="button" className={styles["menu-perfil__edit-btn"]} onClick={resetEdit}>Cancelar</button>
                      }
                    </div>

                    {/* modo lectura */}
                    {!editando && (
                      plantelesAgrupados.length > 0
                        ? plantelesAgrupados.map(({ plantel, turnos }) => (
                          <div key={plantel.id} className={styles["menu-perfil__plantel-fila"]}>
                            <span className={styles["menu-perfil__plantel-nombre"]} title={plantel.nombre}>{plantel.nombre}</span>
                            <span className={styles["menu-perfil__turnos-badges"]}>
                              {turnos.map(t => {
                                const m = ['matutino','vespertino','mixto'].includes(t.nombre.toLowerCase()) ? t.nombre.toLowerCase() : 'otro';
                                return <span key={t.id} className={`${styles['menu-perfil__turno-badge']} ${styles[`menu-perfil__turno-badge--${m}`]}`}>{t.nombre}</span>;
                              })}
                            </span>
                          </div>
                        ))
                        : <p className={styles["menu-perfil__sin-planteles"]}>Sin planteles configurados</p>
                    )}

                    {/* modo edición */}
                    {editando && (
                      <>
                        {/* caso 1 y 3: quitar plantel o cambiar turno */}
                        {editState.map(({ plantel, turnos }) => (
                          <div key={plantel.id} className={`${styles["menu-perfil__plantel-fila"]} ${styles["menu-perfil__plantel-fila--edit"]}`}>
                            <span className={styles["menu-perfil__plantel-nombre"]} title={plantel.nombre}>{plantel.nombre}</span>
                            <span className={styles["menu-perfil__turnos-badges"]}>
                              {TURNOS_FIJOS.map(tn => {
                                const activo = turnos.has(tn);
                                const cl = tn.toLowerCase();
                                return (
                                  <button key={tn} type="button"
                                    title={activo ? `Quitar ${tn}` : `Agregar ${tn}`}
                                    className={`${styles['menu-perfil__turno-toggle']} ${activo ? styles[`menu-perfil__turno-toggle--${cl}`] : styles['menu-perfil__turno-toggle--off']}`}
                                    onClick={() => toggleTurno(plantel.id, tn)}
                                  >{tn[0]}</button>
                                );
                              })}
                            </span>
                            <button type="button" className={styles["menu-perfil__remove-btn"]} title="Quitar plantel" onClick={() => quitarPlantel(plantel.id)}>
                              <X size={12} />
                            </button>
                          </div>
                        ))}

                        {/* caso 2: agregar plantel */}
                        {!buscando
                          ? (
                            <button type="button" className={styles["menu-perfil__agregar-btn"]} onClick={() => setBuscando(true)}>
                              <Plus size={12} />Agregar plantel
                            </button>
                          ) : (
                            <div className={styles["menu-perfil__buscar-wrap"]}>
                              <input
                                autoFocus
                                type="text"
                                className={styles["menu-perfil__buscar-input"]}
                                placeholder="Buscar por nombre o número…"
                                value={busqueda}
                                onChange={e => setBusqueda(e.target.value)}
                              />
                              {busqueda.length >= 1 && (
                                <div className={styles["menu-perfil__resultados"]}>
                                  {cargandoOpciones
                                    ? <div className={styles["menu-perfil__resultado-vacio"]}>Cargando…</div>
                                    : (() => {
                                        const q = busqueda.toLowerCase();
                                        const lista = (plantelesCache.current || [])
                                          .filter(p => !editState.some(e => e.plantel.id === p.id) &&
                                            (p.nombre.toLowerCase().includes(q) || String(p.id).includes(q)))
                                          .slice(0, 6);
                                        return lista.length
                                          ? lista.map(p => (
                                            <button key={p.id} type="button" className={styles["menu-perfil__resultado-item"]} onClick={() => agregarPlantel(p)}>
                                              {p.nombre}
                                            </button>
                                          ))
                                          : <div className={styles["menu-perfil__resultado-vacio"]}>Sin resultados</div>;
                                      })()
                                  }
                                </div>
                              )}
                            </div>
                          )
                        }

                        {/* guardar */}
                        <div className={styles["menu-perfil__edit-footer"]}>
                          {errorEdit && <span className={styles["menu-perfil__error-edit"]}>{errorEdit}</span>}
                          <button type="button" className={styles["menu-perfil__save-btn"]}
                            onClick={guardarCambios} disabled={guardando || editState.length === 0}>
                            {guardando ? 'Guardando…' : 'Guardar cambios'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  <ul className={styles["menu-perfil__datos"]}>
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

      <SolicitudAdmin
        abierto={solicitudAbierto}
        onCerrar={() => setSolicitudAbierto(false)}
      />
    </div>
  );
}
