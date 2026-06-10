import { useMemo, useRef, useState, useEffect } from "react";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import multiMonthPlugin from "@fullcalendar/multimonth";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";

import {
  CalendarDays, CalendarRange, LayoutGrid, List, ChevronLeft, ChevronRight,
  ChevronDown, Plus, Download, Pencil, Copy, Trash2, Settings2, Filter, Tag,
} from "lucide-react";
import Modal from "../../../components/modal/Modal.jsx";
import {
  NOMBRES_MES, aClaveFecha, desdeClaveFecha, sumarDias, formatoHora,
  formatoFechaLarga, calcularSemestre, ahoraMexico,
} from "../../../lib/fechas.js";
import { TIPOS, AREAS, COLORES_TIPO, eventosIniciales } from "../../../data/calendario.js";
import VistaAnual from "./vistas/VistaAnual.jsx";   
import VistaLista from "./vistas/VistaLista.jsx";   
import styles from "./calendario.module.css";
import "./fullcalendar.css";

const COLOR_HEX = {
  azul: "#0147d4", naranja: "#ef7d15", morado: "#7b3fe4", verde: "#2e9d41",
  teal: "#0f9b8e", marino: "#1f3b8f", rojo: "#e5484d", gris: "#97a3b6",
};

const VISTAS = [
  { id: "mes", etiqueta: "Mes", icono: CalendarDays, fc: "dayGridMonth" },
  { id: "semana", etiqueta: "Semana", icono: CalendarRange, fc: "timeGridWeek" },
  { id: "anual", etiqueta: "Anual", icono: LayoutGrid, fc: "multiMonthYear" },
  { id: "lista", etiqueta: "Lista", icono: List, fc: "listMonth" },
];

/* Valores iniciales de los formularios (evento nuevo y tipo nuevo). */
const FORM_EVENTO_VACIO = {
  titulo: "", tipo: "academico", area: "Académica", fecha: "", fechaFin: "",
  horaInicio: "", horaFin: "", lugar: "", formato: "punto",
};
const FORM_TIPO_VACIO = { id: null, etiqueta: "", color: "azul" };

export default function Calendario() {

  const hoy = useMemo(() => ahoraMexico(), []); // fecha/hora real en zona MX
  const claveHoy = aClaveFecha(hoy);            // "YYYY-MM-DD" de hoy

  const [tipos, setTipos] = useState(TIPOS);                          // tipos de evento (CRUD)
  const [eventos, setEventos] = useState(() => eventosIniciales());   // eventos (CRUD)
  const [vista, setVista] = useState("mes");                          // vista activa
  const [fechaActual, setFechaActual] = useState(hoy);                // mes/fecha que muestra FC
  const [tituloVista, setTituloVista] = useState("");                 // título que da FC (semana/anual/lista)
  const [fechaSeleccionada, setFechaSeleccionada] = useState(claveHoy); // día resaltado
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroArea, setFiltroArea] = useState("todas");
  const [pickerAbierto, setPickerAbierto] = useState(false);            // selector de mes
  const [anioPicker, setAnioPicker] = useState(() => hoy.getFullYear());
  const [vistaMenu, setVistaMenu] = useState(false);                    // menú desplegable de vista

  // Estado de los 3 modales
  const [modalEvento, setModalEvento] = useState(false);
  const [formEvento, setFormEvento] = useState(FORM_EVENTO_VACIO);
  const [eventoEditando, setEventoEditando] = useState(null);
  const [modalEliminar, setModalEliminar] = useState(null);
  const [modalTipo, setModalTipo] = useState(false);
  const [formTipo, setFormTipo] = useState(FORM_TIPO_VACIO);

  // Referencias: a FullCalendar (para controlarlo) y a los desplegables.
  const calendarRef = useRef(null);
  const pickerRef = useRef(null);
  const vistaRef = useRef(null);

  // Acceso corto a la API de FullCalendar (prev, next, today, changeView...).
  const api = () => calendarRef.current?.getApi();

  useEffect(() => {
    const alClicar = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerAbierto(false);
      if (vistaRef.current && !vistaRef.current.contains(e.target)) setVistaMenu(false);
    };
    document.addEventListener("mousedown", alClicar);
    return () => document.removeEventListener("mousedown", alClicar);
  }, []);

  // Mapa id -> tipo, para buscar color/etiqueta de un evento rápidamente.
  const tiposPorId = useMemo(() => {
    const mapa = new Map();
    for (const t of tipos) mapa.set(t.id, t);
    return mapa;
  }, [tipos]);

  const colorTipo = (id) => tiposPorId.get(id)?.color ?? "gris";
  const etiquetaTipo = (id) => tiposPorId.get(id)?.etiqueta ?? "Sin tipo";

  // Semestre (A/B) según el mes que se está viendo (insignia del encabezado).
  const semestre = calcularSemestre(fechaActual);

  // Eventos visibles tras aplicar los filtros de tipo y área.
  const eventosFiltrados = useMemo(() => {
    return eventos.filter((ev) => {
      if (filtroTipo !== "todos" && ev.tipo !== filtroTipo) return false;
      if (filtroArea !== "todas" && ev.area !== filtroArea) return false;
      return true;
    });
  }, [eventos, filtroTipo, filtroArea]);

  const eventosFC = useMemo(() => {
    return eventosFiltrados.map((ev) => {
      const color = COLOR_HEX[colorTipo(ev.tipo)] || COLOR_HEX.gris;
      const base = {
        id: String(ev.id),
        title: ev.titulo,
        backgroundColor: color,
        borderColor: color,
        extendedProps: { original: ev },
      };
      if (ev.horaInicio) {
        return {
          ...base,
          start: `${ev.fecha}T${ev.horaInicio}`,
          end: ev.horaFin ? `${ev.fecha}T${ev.horaFin}` : undefined,
        };
      }
      const finBase = ev.fechaFin || ev.fecha;
      return {
        ...base,
        allDay: true,
        start: ev.fecha,
        end: aClaveFecha(sumarDias(desdeClaveFecha(finBase), 1)),
      };
    });
  }, [eventosFiltrados, tiposPorId]);

  /* Mapa "YYYY-MM-DD" -> eventos de ese día (para el panel inferior). Incluye
     cada día que abarca un evento de varios días */
  const eventosPorDia = useMemo(() => {
    const mapa = new Map();
    for (const ev of eventosFiltrados) {
      const inicio = desdeClaveFecha(ev.fecha);
      const fin = ev.fechaFin ? desdeClaveFecha(ev.fechaFin) : inicio;
      const cursor = new Date(inicio);
      while (cursor <= fin) {
        const clave = aClaveFecha(cursor);
        if (!mapa.has(clave)) mapa.set(clave, []);
        mapa.get(clave).push(ev);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => (a.horaInicio || "").localeCompare(b.horaInicio || ""));
    }
    return mapa;
  }, [eventosFiltrados]);

  // Eventos del día seleccionado (lo que muestra la tabla de abajo)
  const eventosDelDia = fechaSeleccionada ? eventosPorDia.get(fechaSeleccionada) || [] : [];

  const esVistaFC = vista === "mes" || vista === "semana";
  const usaPicker = vista === "mes" || vista === "lista";

  // Texto que se muestra en la toolbar según la vista.
  const tituloBarra = useMemo(() => {
    if (vista === "semana") return tituloVista.charAt(0).toUpperCase() + tituloVista.slice(1);
    if (vista === "anual") {
      const ciclo = fechaActual.getMonth() >= 7 ? fechaActual.getFullYear() : fechaActual.getFullYear() - 1;
      return `Ciclo ${ciclo} – ${ciclo + 1}`;
    }
    return `${NOMBRES_MES[fechaActual.getMonth()]} ${fechaActual.getFullYear()}`; // mes y lista
  }, [vista, fechaActual, tituloVista]);

  const irHoy = () => {
    setFechaSeleccionada(claveHoy);
    setFechaActual(hoy);
    if (esVistaFC) api()?.today();
  };

  const mover = (delta) => {
    if (vista === "anual") {
      setFechaActual((x) => new Date(x.getFullYear() + delta, x.getMonth(), 1));
    } else if (vista === "lista") {
      setFechaActual((x) => new Date(x.getFullYear(), x.getMonth() + delta, 1));
    } else {
      api()?.[delta < 0 ? "prev" : "next"]();
    }
  };
  const irAnterior = () => mover(-1);
  const irSiguiente = () => mover(1);

  // Cambiar de vista (Mes / Semana / Anual / Lista)
  const cambiarVista = (v) => {
    const nuevaFC = v.id === "mes" || v.id === "semana";
    if (esVistaFC && nuevaFC) api()?.changeView(v.fc);
    setVista(v.id);
    setVistaMenu(false);
  };

  // Saltar a un mes desde el selector
  const elegirMes = (mes) => {
    setPickerAbierto(false);
    if (esVistaFC) api()?.gotoDate(new Date(anioPicker, mes, 1));
    else setFechaActual(new Date(anioPicker, mes, 1));
  };

  const alCambiarFechas = (arg) => {
    setFechaActual(arg.view.calendar.getDate());
    setTituloVista(arg.view.title);
  };

  // Clic en un día, se marca como seleccionado (resalta la celda + panel)
  const alClicarFecha = (arg) => setFechaSeleccionada(arg.dateStr.slice(0, 10));

  // Clic en un evento, abrir el modal de edición con ese evento 
  const alClicarEvento = (arg) => {
    arg.jsEvent.preventDefault();
    document.querySelectorAll(".fc-popover").forEach((el) => el.remove());
    const original = arg.event.extendedProps.original;
    if (original) {
      setFechaSeleccionada(original.fecha);
      abrirEditarEvento(original);
    }
  };

  // Devuelve la clase del día seleccionado para que FullCalendar la pinte (sea el dia actual o el seleccionado) */
  const claseDiaSeleccionado = (arg) =>
    aClaveFecha(arg.date) === fechaSeleccionada ? "cal-fc-sel" : "";

  // CRUD DE EVENTOS (crear, editar, duplicar, eliminar) */
  const abrirNuevoEvento = () => {
    setEventoEditando(null);
    setFormEvento({ ...FORM_EVENTO_VACIO, fecha: fechaSeleccionada || claveHoy });
    setModalEvento(true);
  };

  const abrirEditarEvento = (ev) => {
    setEventoEditando(ev.id);
    setFormEvento({
      titulo: ev.titulo, tipo: ev.tipo, area: ev.area, fecha: ev.fecha,
      fechaFin: ev.fechaFin || "", horaInicio: ev.horaInicio || "",
      horaFin: ev.horaFin || "", lugar: ev.lugar || "", formato: ev.formato || "punto",
    });
    setModalEvento(true);
  };

  const duplicarEvento = (ev) => {
    setEventos((prev) => [...prev, { ...ev, id: Date.now(), titulo: `${ev.titulo} (copia)` }]);
  };

  const actualizarCampoEvento = (campo) => (e) =>
    setFormEvento((prev) => ({ ...prev, [campo]: e.target.value }));

  const guardarEvento = (e) => {
    e.preventDefault();
    const datos = {
      ...formEvento,
      titulo: formEvento.titulo.trim(),
      lugar: formEvento.lugar.trim(),
      fechaFin: formEvento.fechaFin || null,
    };
    if (eventoEditando) {
      setEventos((prev) => prev.map((ev) => (ev.id === eventoEditando ? { ...ev, ...datos } : ev)));
    } else {
      setEventos((prev) => [...prev, { ...datos, id: Date.now() }]);
    }
    setFechaSeleccionada(datos.fecha);
    api()?.gotoDate(datos.fecha);
    setModalEvento(false);
  };

  const confirmarEliminar = () => {
    setEventos((prev) => prev.filter((ev) => ev.id !== modalEliminar.id));
    setModalEliminar(null);
  };

  const eliminarDesdeEdicion = () => {
    const ev = eventos.find((e) => e.id === eventoEditando);
    setModalEvento(false);
    if (ev) setModalEliminar(ev);
  };

  // CRUD DE TIPOS DE EVENTO (la simbología y los filtros salen de aquí)
  const abrirNuevoTipo = () => {
    setFormTipo(FORM_TIPO_VACIO);
    setModalTipo(true);
  };

  const abrirEditarTipo = (tipo) => {
    setFormTipo({ id: tipo.id, etiqueta: tipo.etiqueta, color: tipo.color });
    setModalTipo(true);
  };

  const guardarTipo = (e) => {
    e.preventDefault();
    const etiqueta = formTipo.etiqueta.trim();
    if (!etiqueta) return;
    if (formTipo.id) {
      setTipos((prev) =>
        prev.map((t) => (t.id === formTipo.id ? { ...t, etiqueta, color: formTipo.color } : t))
      );
    } else {
      const id = etiqueta.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
      setTipos((prev) => [...prev, { id, etiqueta, color: formTipo.color }]);
    }
    setModalTipo(false);
  };

  const eliminarTipo = (tipo) => {
    if (tipos.length <= 1) return;
    const reemplazo = tipos.find((t) => t.id !== tipo.id);
    setEventos((prev) =>
      prev.map((ev) => (ev.tipo === tipo.id ? { ...ev, tipo: reemplazo.id } : ev))
    );
    if (filtroTipo === tipo.id) setFiltroTipo("todos");
    setTipos((prev) => prev.filter((t) => t.id !== tipo.id));
  };

  const tipoEnUso = (id) => eventos.some((ev) => ev.tipo === id);

  return (
    <div className={styles["calendario"]}>
      {/* ENCABEZADO: título + insignia del semestre */}
      <header className={styles["calendario__encabezado"]}>
        <div>
          <h2 className={styles["calendario__titulo"]}>Calendario institucional</h2>
          <span className={`etiqueta etiqueta--rojo ${styles["calendario__semestre"]}`}>
            SEMESTRE {semestre.ciclo}-{semestre.letra}
          </span>
        </div>
      </header>

      {/* CUERPO: columna principal (toolbar + calendario + panel) y aside derecho */}
      <div className={styles["calendario__cuerpo"]}>
        <div className={styles["calendario__principal"]}>
          {/* TOOLBAR (controla a FullCalendar por su API) */}
          <div className={styles["barra"]}>
            <div className={styles["barra__navegacion"]}>
              <button type="button" className="boton boton--fantasma boton--pequeno" onClick={irHoy}>
                Hoy
              </button>
              <button type="button" className={styles["barra__flecha"]} onClick={irAnterior} aria-label="Anterior">
                <ChevronLeft size={18} />
              </button>
              <button type="button" className={styles["barra__flecha"]} onClick={irSiguiente} aria-label="Siguiente">
                <ChevronRight size={18} />
              </button>

              {/* Mes y Lista: selector de mes/año. Semana y Anual: solo el título. */}
              {usaPicker ? (
                <div className={styles["barra__mes"]} ref={pickerRef}>
                  <button
                    type="button"
                    className={styles["barra__mes-boton"]}
                    onClick={() => {
                      setAnioPicker(fechaActual.getFullYear());
                      setPickerAbierto((v) => !v);
                    }}
                  >
                    {tituloBarra}
                    <ChevronDown size={16} />
                  </button>

                  {pickerAbierto && (
                    <div className={styles["picker"]}>
                      <div className={styles["picker__anios"]}>
                        <button type="button" onClick={() => setAnioPicker((a) => a - 1)} aria-label="Año anterior">
                          <ChevronLeft size={16} />
                        </button>
                        <span>{anioPicker}</span>
                        <button type="button" onClick={() => setAnioPicker((a) => a + 1)} aria-label="Año siguiente">
                          <ChevronRight size={16} />
                        </button>
                      </div>
                      <div className={styles["picker__meses"]}>
                        {NOMBRES_MES.map((nombre, i) => {
                          const activo = i === fechaActual.getMonth() && anioPicker === fechaActual.getFullYear();
                          return (
                            <button
                              type="button"
                              key={nombre}
                              className={`${styles["picker__mes"]} ${activo ? styles["picker__mes--activo"] : ""}`}
                              onClick={() => elegirMes(i)}
                            >
                              {nombre.slice(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <span className={styles["barra__rango"]}>{tituloBarra}</span>
              )}
            </div>

            <div className={styles["barra__derecha"]}>
              {/* Desplegable para elegir la vista (Mes/Semana/Anual/Lista) */}
              <div className={styles["vista"]} ref={vistaRef}>
                <button
                  type="button"
                  className={styles["vista__boton"]}
                  aria-haspopup="listbox"
                  aria-expanded={vistaMenu}
                  onClick={() => setVistaMenu((v) => !v)}
                >
                  {(() => {
                    const actual = VISTAS.find((v) => v.id === vista) || VISTAS[0];
                    const Icono = actual.icono;
                    return (
                      <>
                        <Icono size={16} />
                        {actual.etiqueta}
                      </>
                    );
                  })()}
                  <ChevronDown size={16} />
                </button>

                {vistaMenu && (
                  <div className={styles["vista__menu"]} role="listbox">
                    {VISTAS.map((v) => {
                      const Icono = v.icono;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          role="option"
                          aria-selected={vista === v.id}
                          className={`${styles["vista__item"]} ${vista === v.id ? styles["vista__item--activa"] : ""}`}
                          onClick={() => cambiarVista(v)}
                        >
                          <Icono size={16} />
                          <span className={styles["vista__item-texto"]}>{v.etiqueta}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Exportar: deshabilitado por ahora */}
              <button type="button" className="boton boton--fantasma" disabled title="Disponible próximamente">
                <Download size={16} />
                Exportar
              </button>
              <button type="button" className="boton boton--primario" onClick={abrirNuevoEvento}>
                <Plus size={16} />
                Nuevo evento
              </button>
            </div>
          </div>

          {/* ---- EL CALENDARIO ----
               Mes y Semana las dibuja FullCalendar; Anual y Lista son
               componentes propios */}
          {esVistaFC ? (
            <div className={`tarjeta ${styles["lienzo"]}`}>
              <div className="cal-fc">
                <FullCalendar
                  ref={calendarRef}
                  plugins={[dayGridPlugin, timeGridPlugin, multiMonthPlugin, listPlugin, interactionPlugin]}
                  initialView={vista === "semana" ? "timeGridWeek" : "dayGridMonth"}
                  initialDate={aClaveFecha(fechaActual)}
                  headerToolbar={false}
                  locale={esLocale}
                  firstDay={0}
                  height={vista === "semana" ? 640 : 720}
                  expandRows
                  dayMaxEvents
                  nowIndicator
                  fixedWeekCount={false}
                  slotMinTime="06:00:00"
                  slotMaxTime="22:00:00"
                  scrollTime="07:00:00"
                  allDayText="Todo el día"
                  eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
                  events={eventosFC}
                  dayCellClassNames={claseDiaSeleccionado}
                  datesSet={alCambiarFechas}
                  dateClick={alClicarFecha}
                  eventClick={alClicarEvento}
                />
              </div>
            </div>
          ) : vista === "anual" ? (
            <VistaAnual
              fechaActual={fechaActual}
              eventosPorDia={eventosPorDia}
              colorTipo={colorTipo}
              claveHoy={claveHoy}
              fechaSeleccionada={fechaSeleccionada}
              onSeleccionarDia={setFechaSeleccionada}
            />
          ) : (
            <VistaLista
              eventos={eventosFiltrados}
              fechaActual={fechaActual}
              colorTipo={colorTipo}
              etiquetaTipo={etiquetaTipo}
              onSeleccionarDia={setFechaSeleccionada}
              onEditar={abrirEditarEvento}
              onDuplicar={duplicarEvento}
              onEliminar={(ev) => setModalEliminar(ev)}
            />
          )}

          {/* PANEL DE EVENTOS DEL DÍA SELECCIONADO */}
          <div className={`tarjeta ${styles["panel-dia"]}`}>
            <div className={styles["panel-dia__cabecera"]}>
              <h3 className={styles["panel-dia__titulo"]}>
                {fechaSeleccionada ? formatoFechaLarga(fechaSeleccionada) : "Selecciona un día"}
              </h3>
              <span className={styles["panel-dia__conteo"]}>
                {eventosDelDia.length} {eventosDelDia.length === 1 ? "evento" : "eventos"}
              </span>
            </div>

            {eventosDelDia.length === 0 ? (
              <p className={styles["panel-dia__vacio"]}>
                No hay eventos programados para este día.
              </p>
            ) : (
              <div className={styles["tabla-envoltura"]}>
                <table className={styles["tabla"]}>
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th>Evento</th>
                      <th>Área</th>
                      <th>Lugar / Grupo</th>
                      <th>Tipo</th>
                      <th className={styles["tabla__acciones-col"]}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventosDelDia.map((ev) => (
                      <tr key={ev.id}>
                        <td>
                          <span className={styles["tabla__hora"]}>
                            <span className={`${styles["tabla__bolita"]} ${styles[`tabla__bolita--${colorTipo(ev.tipo)}`]}`} />
                            {ev.horaInicio ? formatoHora(ev.horaInicio) : "Todo el día"}
                          </span>
                        </td>
                        <td className={styles["tabla__evento"]}>{ev.titulo}</td>
                        <td className={styles["tabla__tenue"]}>{ev.area}</td>
                        <td className={styles["tabla__tenue"]}>{ev.lugar || "—"}</td>
                        <td>
                          <span className={`etiqueta etiqueta--${colorTipo(ev.tipo)}`}>
                            {etiquetaTipo(ev.tipo)}
                          </span>
                        </td>
                        <td>
                          <div className={styles["tabla__acciones"]}>
                            <button type="button" onClick={() => abrirEditarEvento(ev)} aria-label="Editar" title="Editar">
                              <Pencil size={15} />
                            </button>
                            <button type="button" onClick={() => duplicarEvento(ev)} aria-label="Duplicar" title="Duplicar">
                              <Copy size={15} />
                            </button>
                            <button
                              type="button"
                              className={styles["tabla__borrar"]}
                              onClick={() => setModalEliminar(ev)}
                              aria-label="Eliminar"
                              title="Eliminar"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ---- ASIDE DERECHO: simbología, tipos de evento y filtros ---- */}
        <aside className={styles["calendario__aside"]}>
          {/* Simbología: leyenda de colores (sale de los tipos de evento) */}
          <article className="tarjeta">
            <div className="tarjeta__cabecera">
              <div className="tarjeta__titulo">
                <Tag size={16} />
                Simbología
              </div>
            </div>
            <ul className={styles["simbologia"]}>
              {tipos.map((t) => (
                <li key={t.id} className={styles["simbologia__item"]}>
                  <span className={`${styles["simbologia__punto"]} ${styles[`simbologia__punto--${t.color}`]}`} />
                  <span className={styles["simbologia__texto"]}>{t.etiqueta}</span>
                </li>
              ))}
            </ul>
          </article>

          {/* Tipos de evento: lista con crear, editar y eliminar */}
          <article className="tarjeta">
            <div className="tarjeta__cabecera">
              <div className="tarjeta__titulo">
                <Settings2 size={16} />
                Tipos de eventos
              </div>
              <button type="button" className="tarjeta__enlace" onClick={abrirNuevoTipo}>
                <Plus size={14} />
                Nuevo tipo
              </button>
            </div>
            <ul className={styles["tipos"]}>
              {tipos.map((tipo) => (
                <li key={tipo.id} className={styles["tipos__item"]}>
                  <span className={`etiqueta etiqueta--${tipo.color}`}>{tipo.etiqueta}</span>
                  <div className={styles["tipos__acciones"]}>
                    <button type="button" onClick={() => abrirEditarTipo(tipo)} aria-label={`Editar ${tipo.etiqueta}`} title="Editar">
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminarTipo(tipo)}
                      disabled={tipos.length <= 1}
                      aria-label={`Eliminar ${tipo.etiqueta}`}
                      title={tipoEnUso(tipo.id) ? "Los eventos se reasignarán a otro tipo" : "Eliminar"}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </article>

          {/* Filtros rápidos */}
          <article className="tarjeta">
            <div className="tarjeta__cabecera">
              <div className="tarjeta__titulo">
                <Filter size={16} />
                Filtros rápidos
              </div>
              {(filtroTipo !== "todos" || filtroArea !== "todas") && (
                <button
                  type="button"
                  className="tarjeta__enlace"
                  onClick={() => {
                    setFiltroTipo("todos");
                    setFiltroArea("todas");
                  }}
                >
                  Limpiar filtros
                </button>
              )}
            </div>
            <div className={styles["filtros"]}>
              <label className="formulario__campo">
                <span className="formulario__etiqueta">Tipo de evento</span>
                <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                  <option value="todos">Todos</option>
                  {tipos.map((t) => (
                    <option key={t.id} value={t.id}>{t.etiqueta}</option>
                  ))}
                </select>
              </label>
              <label className="formulario__campo">
                <span className="formulario__etiqueta">Área</span>
                <select value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)}>
                  <option value="todas">Todas</option>
                  {AREAS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </label>
            </div>
          </article>
        </aside>
      </div>

      {/* Modal: crear y editar evento */}
      <Modal
        abierto={modalEvento}
        titulo={eventoEditando ? "Editar evento" : "Nuevo evento"}
        onCerrar={() => setModalEvento(false)}
        pie={
          <>
            {eventoEditando && (
              <button
                type="button"
                className="boton boton--peligro"
                style={{ marginRight: "auto" }}
                onClick={eliminarDesdeEdicion}
              >
                <Trash2 size={16} />
                Eliminar
              </button>
            )}
            <button type="button" className="boton boton--fantasma" onClick={() => setModalEvento(false)}>
              Cancelar
            </button>
            <button type="submit" form="form-evento-calendario" className="boton boton--primario">
              {eventoEditando ? "Guardar cambios" : "Crear evento"}
            </button>
          </>
        }
      >
        <form id="form-evento-calendario" className="formulario" onSubmit={guardarEvento}>
          <label className="formulario__campo">
            <span className="formulario__etiqueta">Título</span>
            <input type="text" required placeholder="Nombre del evento" value={formEvento.titulo} onChange={actualizarCampoEvento("titulo")} />
          </label>

          <div className="formulario__fila">
            <label className="formulario__campo">
              <span className="formulario__etiqueta">Tipo de evento</span>
              <select value={formEvento.tipo} onChange={actualizarCampoEvento("tipo")}>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>{t.etiqueta}</option>
                ))}
              </select>
            </label>
            <label className="formulario__campo">
              <span className="formulario__etiqueta">Área</span>
              <select value={formEvento.area} onChange={actualizarCampoEvento("area")}>
                {AREAS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="formulario__fila">
            <label className="formulario__campo">
              <span className="formulario__etiqueta">Fecha inicio</span>
              <input type="date" required value={formEvento.fecha} onChange={actualizarCampoEvento("fecha")} />
            </label>
            <label className="formulario__campo">
              <span className="formulario__etiqueta">Fecha fin (opcional)</span>
              <input type="date" value={formEvento.fechaFin} min={formEvento.fecha} onChange={actualizarCampoEvento("fechaFin")} />
            </label>
          </div>

          <div className="formulario__fila">
            <label className="formulario__campo">
              <span className="formulario__etiqueta">Hora inicio</span>
              <input type="time" value={formEvento.horaInicio} onChange={actualizarCampoEvento("horaInicio")} />
            </label>
            <label className="formulario__campo">
              <span className="formulario__etiqueta">Hora fin</span>
              <input type="time" value={formEvento.horaFin} onChange={actualizarCampoEvento("horaFin")} />
            </label>
          </div>

          <label className="formulario__campo">
            <span className="formulario__etiqueta">Lugar / Grupo</span>
            <input type="text" placeholder="Aula, auditorio, explanada..." value={formEvento.lugar} onChange={actualizarCampoEvento("lugar")} />
          </label>

          <label className="formulario__campo">
            <span className="formulario__etiqueta">Representación en el calendario</span>
            <select value={formEvento.formato} onChange={actualizarCampoEvento("formato")}>
              <option value="punto">Puntual (con hora)</option>
              <option value="rango">Todo el día / periodo (abarca días)</option>
            </select>
          </label>
        </form>
      </Modal>

      {/* Modal: eliminar evento */}
      <Modal
        abierto={Boolean(modalEliminar)}
        titulo="Eliminar evento"
        onCerrar={() => setModalEliminar(null)}
        pie={
          <>
            <button type="button" className="boton boton--fantasma" onClick={() => setModalEliminar(null)}>
              Cancelar
            </button>
            <button type="button" className="boton boton--peligro" onClick={confirmarEliminar}>
              <Trash2 size={16} />
              Eliminar
            </button>
          </>
        }
      >
        <p className={styles["confirmacion"]}>
          ¿Seguro que deseas eliminar <strong>{modalEliminar?.titulo}</strong>? Esta
          acción no se puede deshacer.
        </p>
      </Modal>

      {/* Modal: crear y editar tipo de evento */}
      <Modal
        abierto={modalTipo}
        titulo={formTipo.id ? "Editar tipo de evento" : "Nuevo tipo de evento"}
        onCerrar={() => setModalTipo(false)}
        pie={
          <>
            <button type="button" className="boton boton--fantasma" onClick={() => setModalTipo(false)}>
              Cancelar
            </button>
            <button type="submit" form="form-tipo" className="boton boton--primario">
              Guardar
            </button>
          </>
        }
      >
        <form id="form-tipo" className="formulario" onSubmit={guardarTipo}>
          <label className="formulario__campo">
            <span className="formulario__etiqueta">Nombre</span>
            <input
              type="text"
              required
              placeholder="Ej. Académico"
              value={formTipo.etiqueta}
              onChange={(e) => setFormTipo((prev) => ({ ...prev, etiqueta: e.target.value }))}
            />
          </label>
          <label className="formulario__campo">
            <span className="formulario__etiqueta">Color</span>
            <select
              value={formTipo.color}
              onChange={(e) => setFormTipo((prev) => ({ ...prev, color: e.target.value }))}
            >
              {COLORES_TIPO.map((c) => (
                <option key={c.valor} value={c.valor}>{c.etiqueta}</option>
              ))}
            </select>
          </label>
          <div className={styles["tipo-vista-previa"]}>
            <span className="formulario__etiqueta">Vista previa</span>
            <span className={`etiqueta etiqueta--${formTipo.color}`}>
              {formTipo.etiqueta.trim() || "Tipo de evento"}
            </span>
          </div>
        </form>
      </Modal>
    </div>
  );
}
