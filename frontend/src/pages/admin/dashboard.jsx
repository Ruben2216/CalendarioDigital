import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutDashboard, Calendar, Clock, Users, Menu, Bell, ChevronDown, ChevronLeft, ChevronRight, Plus, MapPin, Pencil, AlertTriangle, FileText, GraduationCap, Megaphone, LogOut, CheckCheck, Trash2, TrendingUp, AlertCircle, } from "lucide-react";
import Modal from "../../components/modal/Modal.jsx";
import logoCobach from "../../assets/img/logo-cobach.png";
import styles from "./dashboard.module.css";

const ZONA = "America/Mexico_City";

const CATEGORIAS = {
  academico: { etiqueta: "Académico", color: "azul" },
  cultural: { etiqueta: "Cultural", color: "morado" },
  administrativo: { etiqueta: "Administrativo", color: "naranja" },
  deportivo: { etiqueta: "Deportivo", color: "verde" },
  aviso: { etiqueta: "Aviso", color: "rojo" },
};

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const ABREV_MES = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

const DIAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"];

const NAV = [
  { id: "dashboard", etiqueta: "Dashboard", icono: LayoutDashboard },
  { id: "calendario", etiqueta: "Calendario", icono: Calendar },
  { id: "eventos", etiqueta: "Eventos", icono: Clock },
  { id: "usuarios", etiqueta: "Usuarios", icono: Users },
];

const NOTIFICACIONES_INICIALES = [
  { id: 1, icono: Pencil, color: "azul", titulo: "Examen de Física actualizado al 6 jun", subtitulo: "Hace 2 horas · Prof. García", sinLeer: true },
  { id: 2, icono: Plus, color: "verde", titulo: "Nuevo evento: Torneo deportivo interplantel", subtitulo: "Hace 5 horas · Administración", sinLeer: true },
  { id: 3, icono: Users, color: "gris", titulo: "3 nuevos usuarios registrados", subtitulo: "Ayer · Sistema", sinLeer: true },
  { id: 4, icono: AlertTriangle, color: "naranja", titulo: "Recordatorio: Periodo de inscripciones cierra el 10 jun", subtitulo: "Hace 2 días · Dirección", sinLeer: false },
  { id: 5, icono: FileText, color: "azul", titulo: "Calendario mayo exportado por 12 usuarios", subtitulo: "Hace 3 días", sinLeer: false },
];

const ANUNCIOS = [
  { id: 1, icono: Calendar, color: "azul", titulo: "Nuevo calendario escolar 2026 A", descripcion: "Consulta las fechas importantes del próximo ciclo escolar.", fecha: "15 MAY" },
  { id: 2, icono: GraduationCap, color: "verde", titulo: "Convocatoria de becas institucionales", descripcion: "Abierta del 12 al 30 de mayo de 2026.", fecha: "14 MAY" },
  { id: 3, icono: AlertTriangle, color: "naranja", titulo: "Mantenimiento en plataforma", descripcion: "El sábado 17 de mayo de 8:00 a.m. a 12:00 p.m.", fecha: "13 MAY" },
  { id: 4, icono: FileText, color: "morado", titulo: "Actualización de documentos", descripcion: "Revisa los nuevos formatos en Gestión Documental.", fecha: "12 MAY" },
];

function ahoraMexico() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: ZONA }));
}

function aClaveFecha(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function sumarDias(base, dias) {
  const fecha = new Date(base);
  fecha.setDate(fecha.getDate() + dias);
  return fecha;
}

function desdeClaveFecha(clave) {
  const [anio, mes, dia] = clave.split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

function saludoPorHora(hora) {
  if (hora < 12) return { texto: "Buenos días", emoji: "☀️" };
  if (hora < 19) return { texto: "Buenas tardes", emoji: "🌤️" };
  return { texto: "Buenas noches", emoji: "🌙" };
}

function eventosIniciales(hoy) {
  return [
    { id: 1, titulo: "Examen parcial de Matemáticas", categoria: "academico", fecha: aClaveFecha(hoy), horaInicio: "08:00", horaFin: "10:00", ubicacion: "Aula 12-B" },
    { id: 2, titulo: "Festival cultural COBACH 2026", categoria: "cultural", fecha: aClaveFecha(sumarDias(hoy, 2)), horaInicio: "10:00", horaFin: "14:00", ubicacion: "Explanada" },
    { id: 3, titulo: "Junta de padres de familia", categoria: "administrativo", fecha: aClaveFecha(sumarDias(hoy, 4)), horaInicio: "16:00", horaFin: "18:00", ubicacion: "Auditorio" },
    { id: 4, titulo: "Suspensión de actividades escolares", categoria: "aviso", fecha: aClaveFecha(sumarDias(hoy, 8)), horaInicio: "", horaFin: "", ubicacion: "Toda la comunidad" },
    { id: 5, titulo: "Examen parcial de Química", categoria: "academico", fecha: aClaveFecha(sumarDias(hoy, 11)), horaInicio: "09:00", horaFin: "11:00", ubicacion: "Aula 8-A" },
  ];
}

function formatoHora(hora) {
  if (!hora) return "";
  const [h, m] = hora.split(":").map(Number);
  const periodo = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${periodo}`;
}

function formatoFechaLarga(clave) {
  const texto = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(desdeClaveFecha(clave));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const FORM_VACIO = {
  titulo: "",
  categoria: "academico",
  fecha: "",
  horaInicio: "",
  horaFin: "",
  ubicacion: "",
};

export default function Dashboard() {
  const hoy = useMemo(() => ahoraMexico(), []);

  const [esMovil, setEsMovil] = useState(
    () => window.matchMedia("(max-width: 920px)").matches
  );
  const [menuAbierto, setMenuAbierto] = useState(
    () => !window.matchMedia("(max-width: 920px)").matches
  );
  const [seccionActiva, setSeccionActiva] = useState("dashboard");
  const [notifAbierto, setNotifAbierto] = useState(false);
  const [notificaciones, setNotificaciones] = useState(NOTIFICACIONES_INICIALES);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [cerrarSesionAbierto, setCerrarSesionAbierto] = useState(false);
  const [formulario, setFormulario] = useState(FORM_VACIO);
  const [eventos, setEventos] = useState(() => eventosIniciales(hoy));
  const [mesVisible, setMesVisible] = useState(
    () => new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  );
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null);

  const notifRef = useRef(null);

  useEffect(() => {
    const alClicar = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifAbierto(false);
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

  const seleccionarSeccion = (id) => {
    setSeccionActiva(id);
    if (esMovil) setMenuAbierto(false);
  };

  const saludo = saludoPorHora(hoy.getHours());

  const fechaLarga = useMemo(() => {
    const texto = new Intl.DateTimeFormat("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: ZONA,
    }).format(hoy);
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }, [hoy]);

  const ciclo = useMemo(() => {
    const anio = hoy.getFullYear();
    return hoy.getMonth() >= 7 ? `${anio}–${anio + 1}` : `${anio - 1}–${anio}`;
  }, [hoy]);

  const eventosPorFecha = useMemo(() => {
    const mapa = new Map();
    for (const evento of eventos) {
      if (!mapa.has(evento.fecha)) mapa.set(evento.fecha, []);
      mapa.get(evento.fecha).push(evento);
    }
    return mapa;
  }, [eventos]);

  const claveHoy = aClaveFecha(hoy);

  const eventosDelDia = fechaSeleccionada
    ? eventosPorFecha.get(fechaSeleccionada) || []
    : [];

  const manejarClickDia = (celda) => {
    setFechaSeleccionada(celda.clave);
    if (!celda.delMes) {
      const fecha = desdeClaveFecha(celda.clave);
      setMesVisible(new Date(fecha.getFullYear(), fecha.getMonth(), 1));
    }
  };

  const proximosEventos = useMemo(() => {
    return eventos
      .filter((evento) => evento.fecha >= claveHoy)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [eventos, claveHoy]);

  const celdasCalendario = useMemo(() => {
    const anio = mesVisible.getFullYear();
    const mes = mesVisible.getMonth();
    const primerDiaSemana = new Date(anio, mes, 1).getDay();
    const inicio = new Date(anio, mes, 1 - primerDiaSemana);

    return Array.from({ length: 42 }, (_, i) => {
      const fecha = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
      const clave = aClaveFecha(fecha);
      const eventosDia = eventosPorFecha.get(clave) || [];
      return {
        clave,
        dia: fecha.getDate(),
        delMes: fecha.getMonth() === mes,
        esHoy: clave === claveHoy,
        color: eventosDia.length ? CATEGORIAS[eventosDia[0].categoria].color : null,
      };
    });
  }, [mesVisible, eventosPorFecha, claveHoy]);

  const notifSinLeer = notificaciones.filter((n) => n.sinLeer).length;

  const marcarTodasLeidas = () =>
    setNotificaciones((prev) => prev.map((n) => ({ ...n, sinLeer: false })));

  const limpiarNotificaciones = () => setNotificaciones([]);

  const irMes = (delta) =>
    setMesVisible((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));

  const irHoy = () => setMesVisible(new Date(hoy.getFullYear(), hoy.getMonth(), 1));

  const abrirModal = () => {
    setFormulario({ ...FORM_VACIO, fecha: claveHoy });
    setModalAbierto(true);
  };

  const actualizarCampo = (campo) => (e) =>
    setFormulario((prev) => ({ ...prev, [campo]: e.target.value }));

  const guardarEvento = (e) => {
    e.preventDefault();
    const nuevo = {
      ...formulario,
      id: Date.now(),
      titulo: formulario.titulo.trim(),
      ubicacion: formulario.ubicacion.trim(),
    };
    setEventos((prev) => [...prev, nuevo]);
    const fecha = desdeClaveFecha(nuevo.fecha);
    setMesVisible(new Date(fecha.getFullYear(), fecha.getMonth(), 1));
    setModalAbierto(false);
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
          {NAV.map(({ id, etiqueta, icono: Icono }) => (
            <button
              key={id}
              type="button"
              className={`${styles["navegacion__opcion"]} ${
                seccionActiva === id ? styles["navegacion__opcion--activa"] : ""
              }`}
              onClick={() => seleccionarSeccion(id)}
            >
              <Icono size={18} />
              {etiqueta}
            </button>
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
                {fechaLarga},
                    {" "}
                {hoy.toLocaleTimeString("es-MX", {timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit" })}
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
                    <span className={`${styles["etiqueta"]} ${styles["etiqueta--azul"]}`}>
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
                <small>Plantel</small>
                <strong>COBACH 01 - Tuxtla</strong>
              </div>
              <ChevronDown size={14} />
            </div>

            <div className={styles["usuario"]}>
              <span className={styles["usuario__avatar"]}>JR</span>
              <div className={styles["usuario__info"]}>
                <strong>José R. Clemente</strong>
                <span>Administrador</span>
              </div>
              <ChevronDown size={14} />
            </div>
          </div>
        </header>

        <div className={styles["contenido"]}>
          <section className={styles["rejilla"]}>
            <div className={styles["columna"]}>
              <section className={styles["encabezado"]}>
                <div>
                  <h2 className={styles["encabezado__saludo"]}>
                    {saludo.texto}, José Rubén
                  </h2>
                  <div className={styles["encabezado__subtitulo"]}>
                    <Calendar size={13} />
                    <span>{fechaLarga}</span>
                    <span>·</span>
                    <span>Ciclo {ciclo}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className={`${styles["boton"]} ${styles["boton--primario"]}`}
                  onClick={abrirModal}
                >
                  <Plus size={16} />
                  Nuevo evento
                </button>
              </section>

              <section className={styles["indicadores"]}>
                <article className={styles["indicador"]}>
                  <span className={`${styles["indicador__icono"]} ${styles["indicador__icono--naranja"]}`}>
                    <Users size={21} />
                  </span>
                  <div>
                    <div className={styles["indicador__valor"]}>312</div>
                    <div className={styles["indicador__etiqueta"]}>
                      Usuarios activos
                    </div>
                    <div className={`${styles["indicador__nota"]} ${styles["indicador__nota--positiva"]}`}>
                      <TrendingUp size={12} />
                      18 nuevos esta semana
                    </div>
                  </div>
                </article>

                <article className={styles["indicador"]}>
                  <span className={`${styles["indicador__icono"]} ${styles["indicador__icono--morado"]}`}>
                    <Bell size={21} />
                  </span>
                  <div>
                    <div className={styles["indicador__valor"]}>
                      {notificaciones.length}
                    </div>
                    <div className={styles["indicador__etiqueta"]}>
                      Notificaciones pendientes
                    </div>
                    <div className={`${styles["indicador__nota"]} ${styles["indicador__nota--alerta"]}`}>
                      <AlertCircle size={12} />
                      {notifSinLeer} sin leer
                    </div>
                  </div>
                </article>
              </section>

              <article className={styles["tarjeta"]}>
                <div className={styles["tarjeta__cabecera"]}>
                  <div className={styles["tarjeta__titulo"]}>
                    <Calendar size={16} />
                    Próximos eventos
                  </div>
                  <button
                    type="button"
                    className={styles["tarjeta__enlace"]}
                    onClick={() => seleccionarSeccion("eventos")}
                  >
                    Ver todos
                    <ChevronRight size={14} />
                  </button>
                </div>

                <div className={styles["eventos"]}>
                  {proximosEventos.length === 0 ? (
                    <p className={styles["eventos__vacio"]}>
                      No hay eventos próximos.
                    </p>
                  ) : (
                    proximosEventos.map((evento) => {
                      const fecha = desdeClaveFecha(evento.fecha);
                      const categoria = CATEGORIAS[evento.categoria];
                      return (
                        <div key={evento.id} className={styles["evento"]}>
                          <div className={styles["evento__fecha"]}>
                            <strong>{fecha.getDate()}</strong>
                            <span>{ABREV_MES[fecha.getMonth()]}</span>
                          </div>
                          <div className={styles["evento__copia"]}>
                            <h3 className={styles["evento__titulo"]}>
                              {evento.titulo}
                            </h3>
                            <div className={styles["evento__meta"]}>
                              <span className={`${styles["etiqueta"]} ${styles[`etiqueta--${categoria.color}`]}`}>
                                {categoria.etiqueta}
                              </span>
                              {evento.horaInicio && (
                                <span className={styles["meta"]}>
                                  <Clock size={11} />
                                  {formatoHora(evento.horaInicio)}
                                  {evento.horaFin && ` - ${formatoHora(evento.horaFin)}`}
                                </span>
                              )}
                              {evento.ubicacion && (
                                <span className={styles["meta"]}>
                                  <MapPin size={11} />
                                  {evento.ubicacion}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </article>

              <div className={styles["promo-anuncios"]}>
                <article className={`${styles["tarjeta"]} ${styles["promo"]}`}>
                  <div className={styles["promo__copia"]}>
                    <h3>
                      Transformamos
                      <br />
                      el presente,
                      <br />
                      construimos
                      <br />
                      el futuro.
                    </h3>
                    <p>Colegio de Bachilleres de Chiapas</p>
                  </div>
                  <span className={styles["promo__figura"]} aria-hidden="true">
                    <GraduationCap size={56} />
                  </span>
                </article>

                <article className={styles["tarjeta"]}>
                  <div className={styles["tarjeta__cabecera"]}>
                    <div className={styles["tarjeta__titulo"]}>
                      <Megaphone size={16} />
                      Anuncios
                    </div>
                  </div>
                  <div className={styles["anuncios"]}>
                    {ANUNCIOS.map(({ id, icono: Icono, color, titulo, descripcion, fecha }) => (
                      <div key={id} className={styles["anuncio"]}>
                        <span className={`${styles["anuncio__icono"]} ${styles[`anuncio__icono--${color}`]}`}>
                          <Icono size={14} />
                        </span>
                        <div className={styles["anuncio__copia"]}>
                          <h3 className={styles["anuncio__titulo"]}>{titulo}</h3>
                          <p className={styles["anuncio__descripcion"]}>
                            {descripcion}
                          </p>
                        </div>
                        <span className={styles["anuncio__fecha"]}>{fecha}</span>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            </div>

            <aside className={styles["lateral-derecho"]}>
              <article className={`${styles["tarjeta"]} ${styles["calendario"]}`}>
                <div className={styles["calendario__cabecera"]}>
                  <div className={styles["tarjeta__titulo"]}>
                    <Calendar size={16} />
                    Calendario institucional
                  </div>
                  <div className={styles["calendario__controles"]}>
                    <button
                      type="button"
                      className={styles["calendario__nav"]}
                      onClick={() => irMes(-1)}
                      aria-label="Mes anterior"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      className={styles["calendario__hoy"]}
                      onClick={irHoy}
                    >
                      Hoy
                    </button>
                    <button
                      type="button"
                      className={styles["calendario__nav"]}
                      onClick={() => irMes(1)}
                      aria-label="Mes siguiente"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                <div className={styles["calendario__cuerpo"]}>
                  <h3 className={styles["calendario__mes"]}>
                    {NOMBRES_MES[mesVisible.getMonth()]} {mesVisible.getFullYear()}
                  </h3>

                  <div className={styles["calendario__rejilla"]}>
                    {DIAS_SEMANA.map((dia, i) => (
                      <span key={i} className={styles["calendario__dia-semana"]}>
                        {dia}
                      </span>
                    ))}

                    {celdasCalendario.map((celda) => (
                      <button
                        type="button"
                        key={celda.clave}
                        onClick={() => manejarClickDia(celda)}
                        aria-pressed={fechaSeleccionada === celda.clave}
                        className={`${styles["dia"]} ${
                          celda.delMes ? "" : styles["dia--apagado"]
                        } ${celda.esHoy ? styles["dia--hoy"] : ""} ${
                          celda.color ? styles[`dia--${celda.color}`] : ""
                        } ${
                          fechaSeleccionada === celda.clave
                            ? styles["dia--seleccionado"]
                            : ""
                        }`}
                      >
                        {celda.dia}
                      </button>
                    ))}
                  </div>
                </div>

                {fechaSeleccionada && (
                  <div className={styles["dia-eventos"]}>
                    <div className={styles["dia-eventos__cabecera"]}>
                      <span className={styles["dia-eventos__titulo"]}>
                        {formatoFechaLarga(fechaSeleccionada)}
                      </span>
                      <button
                        type="button"
                        className={styles["dia-eventos__limpiar"]}
                        onClick={() => setFechaSeleccionada(null)}
                      >
                        Limpiar
                      </button>
                    </div>

                    {eventosDelDia.length === 0 ? (
                      <p className={styles["dia-eventos__vacio"]}>
                        No hay eventos para este día.
                      </p>
                    ) : (
                      <ul className={styles["dia-eventos__lista"]}>
                        {eventosDelDia.map((evento) => {
                          const categoria = CATEGORIAS[evento.categoria];
                          return (
                            <li key={evento.id} className={styles["dia-eventos__item"]}>
                              <span className={`${styles["dia-eventos__marca"]} ${styles[`dia-eventos__marca--${categoria.color}`]}`} />
                              <div className={styles["dia-eventos__copia"]}>
                                <p className={styles["dia-eventos__nombre"]}>
                                  {evento.titulo}
                                </p>
                                <div className={styles["dia-eventos__meta"]}>
                                  <span className={`${styles["etiqueta"]} ${styles[`etiqueta--${categoria.color}`]}`}>
                                    {categoria.etiqueta}
                                  </span>
                                  {evento.horaInicio && (
                                    <span className={styles["meta"]}>
                                      <Clock size={11} />
                                      {formatoHora(evento.horaInicio)}
                                      {evento.horaFin && ` - ${formatoHora(evento.horaFin)}`}
                                    </span>
                                  )}
                                  {evento.ubicacion && (
                                    <span className={styles["meta"]}>
                                      <MapPin size={11} />
                                      {evento.ubicacion}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}

                <div className={styles["calendario__leyenda"]}>
                  {Object.values(CATEGORIAS).map((cat) => (
                    <span key={cat.etiqueta} className={styles["leyenda"]}>
                      <span className={`${styles["leyenda__punto"]} ${styles[`leyenda__punto--${cat.color}`]}`} />
                      {cat.etiqueta}
                    </span>
                  ))}
                </div>
              </article>

              <article className={styles["tarjeta"]}>
                <div className={styles["tarjeta__cabecera"]}>
                  <div className={styles["tarjeta__titulo"]}>
                    <Bell size={16} />
                    Notificaciones
                  </div>
                  {notifSinLeer > 0 && (
                    <span className={`${styles["etiqueta"]} ${styles["etiqueta--azul"]}`}>
                      {notifSinLeer} nuevas
                    </span>
                  )}
                </div>

                <div className={styles["panel-notif__lista"]}>
                  {notificaciones.length === 0 ? (
                    <p className={styles["eventos__vacio"]}>
                      No tienes notificaciones.
                    </p>
                  ) : (
                    notificaciones.slice(0, 5).map(({ id, icono: Icono, color, titulo, subtitulo, sinLeer }) => (
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
              </article>
            </aside>
          </section>
        </div>
      </main>

      <Modal
        abierto={modalAbierto}
        titulo="Nuevo evento"
        onCerrar={() => setModalAbierto(false)}
        pie={
          <>
            <button
              type="button"
              className={`${styles["boton"]} ${styles["boton--fantasma"]}`}
              onClick={() => setModalAbierto(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-evento"
              className={`${styles["boton"]} ${styles["boton--primario"]}`}
            >
              Guardar evento
            </button>
          </>
        }
      >
        <form id="form-evento" className={styles["formulario"]} onSubmit={guardarEvento}>
          <label className={styles["formulario__campo"]}>
            <span className={styles["formulario__etiqueta"]}>Título</span>
            <input
              type="text"
              required
              placeholder="Nombre del evento"
              value={formulario.titulo}
              onChange={actualizarCampo("titulo")}
            />
          </label>

          <label className={styles["formulario__campo"]}>
            <span className={styles["formulario__etiqueta"]}>Categoría</span>
            <select value={formulario.categoria} onChange={actualizarCampo("categoria")}>
              {Object.entries(CATEGORIAS).map(([valor, { etiqueta }]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </label>

          <label className={styles["formulario__campo"]}>
            <span className={styles["formulario__etiqueta"]}>Fecha</span>
            <input
              type="date"
              required
              value={formulario.fecha}
              onChange={actualizarCampo("fecha")}
            />
          </label>

          <div className={styles["formulario__fila"]}>
            <label className={styles["formulario__campo"]}>
              <span className={styles["formulario__etiqueta"]}>Hora inicio</span>
              <input
                type="time"
                value={formulario.horaInicio}
                onChange={actualizarCampo("horaInicio")}
              />
            </label>
            <label className={styles["formulario__campo"]}>
              <span className={styles["formulario__etiqueta"]}>Hora fin</span>
              <input
                type="time"
                value={formulario.horaFin}
                onChange={actualizarCampo("horaFin")}
              />
            </label>
          </div>

          <label className={styles["formulario__campo"]}>
            <span className={styles["formulario__etiqueta"]}>Ubicación</span>
            <input
              type="text"
              placeholder="Aula, auditorio, explanada..."
              value={formulario.ubicacion}
              onChange={actualizarCampo("ubicacion")}
            />
          </label>
        </form>
      </Modal>

      <Modal
        abierto={cerrarSesionAbierto}
        titulo="Cerrar sesión"
        onCerrar={() => setCerrarSesionAbierto(false)}
        pie={
          <>
            <button
              type="button"
              className={`${styles["boton"]} ${styles["boton--fantasma"]}`}
              onClick={() => setCerrarSesionAbierto(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={`${styles["boton"]} ${styles["boton--peligro"]}`}
              onClick={() => {
                setCerrarSesionAbierto(false);
                window.location.href = "/login";
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