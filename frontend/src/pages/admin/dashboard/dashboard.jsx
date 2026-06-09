import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar, Clock, Users, Bell, ChevronLeft, ChevronRight, Plus, MapPin, 
  Pencil, AlertTriangle, FileText, GraduationCap, Megaphone, TrendingUp, AlertCircle,
} from "lucide-react";
import Modal from "../../../components/modal/Modal.jsx";
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
    weekday: "long", day: "numeric", month: "long",
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
  const navigate = useNavigate();
  const hoy = useMemo(() => ahoraMexico(), []);

  const [notificaciones] = useState(NOTIFICACIONES_INICIALES);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [formulario, setFormulario] = useState(FORM_VACIO);
  const [eventos, setEventos] = useState(() => eventosIniciales(hoy));
  const [mesVisible, setMesVisible] = useState(
    () => new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  );
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null);

  const saludo = saludoPorHora(hoy.getHours());

  const fechaLarga = useMemo(() => {
    const texto = new Intl.DateTimeFormat("es-MX", {
      weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: ZONA,
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
    <>
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

          <article className="tarjeta">
            <div className="tarjeta__cabecera">
              <div className="tarjeta__titulo">
                <Calendar size={16} />
                Próximos eventos
              </div>
              <button
                type="button"
                className="tarjeta__enlace"
                onClick={() => navigate("/eventos")}
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
                          <span className={`etiqueta etiqueta--${categoria.color}`}>
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
            <article className={`tarjeta ${styles["promo"]}`}>
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

            <article className="tarjeta">
              <div className="tarjeta__cabecera">
                <div className="tarjeta__titulo">
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
          <article className={`tarjeta ${styles["calendario"]}`}>
            <div className={styles["calendario__cabecera"]}>
              <div className="tarjeta__titulo">
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
                              <span className={`etiqueta etiqueta--${categoria.color}`}>
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

          <article className="tarjeta">
            <div className="tarjeta__cabecera">
              <div className="tarjeta__titulo">
                <Bell size={16} />
                Notificaciones
              </div>
              {notifSinLeer > 0 && (
                <span className="etiqueta etiqueta--azul">
                  {notifSinLeer} nuevas
                </span>
              )}
            </div>

            <div className={styles["notif-lista"]}>
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

      <Modal
        abierto={modalAbierto}
        titulo="Nuevo evento"
        onCerrar={() => setModalAbierto(false)}
        pie={
          <>
            <button
              type="button"
              className="boton boton--fantasma"
              onClick={() => setModalAbierto(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-evento-dashboard"
              className="boton boton--primario"
            >
              Guardar evento
            </button>
          </>
        }
      >
        <form id="form-evento-dashboard" className="formulario" onSubmit={guardarEvento}>
          <label className="formulario__campo">
            <span className="formulario__etiqueta">Título</span>
            <input
              type="text"
              required
              placeholder="Nombre del evento"
              value={formulario.titulo}
              onChange={actualizarCampo("titulo")}
            />
          </label>

          <label className="formulario__campo">
            <span className="formulario__etiqueta">Categoría</span>
            <select value={formulario.categoria} onChange={actualizarCampo("categoria")}>
              {Object.entries(CATEGORIAS).map(([valor, { etiqueta }]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </label>

          <label className="formulario__campo">
            <span className="formulario__etiqueta">Fecha</span>
            <input
              type="date"
              required
              value={formulario.fecha}
              onChange={actualizarCampo("fecha")}
            />
          </label>

          <div className="formulario__fila">
            <label className="formulario__campo">
              <span className="formulario__etiqueta">Hora inicio</span>
              <input
                type="time"
                value={formulario.horaInicio}
                onChange={actualizarCampo("horaInicio")}
              />
            </label>
            <label className="formulario__campo">
              <span className="formulario__etiqueta">Hora fin</span>
              <input
                type="time"
                value={formulario.horaFin}
                onChange={actualizarCampo("horaFin")}
              />
            </label>
          </div>

          <label className="formulario__campo">
            <span className="formulario__etiqueta">Ubicación</span>
            <input
              type="text"
              placeholder="Aula, auditorio, explanada..."
              value={formulario.ubicacion}
              onChange={actualizarCampo("ubicacion")}
            />
          </label>
        </form>
      </Modal>
    </>
  );
}
