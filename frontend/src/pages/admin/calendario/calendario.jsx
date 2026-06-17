import { useCallback, useMemo, useRef, useState, useEffect } from "react";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import multiMonthPlugin from "@fullcalendar/multimonth";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";

import {
  CalendarDays, CalendarRange, LayoutGrid, List, ChevronLeft, ChevronRight,
  ChevronDown, Plus, Download, Pencil, Trash2, Settings2, Filter, Tag,
  PanelRight, X, Clock, MapPin, Hourglass,
} from "lucide-react";
import Modal from "../../../components/modal/Modal.jsx";
import AvisoBadge from "../../../components/aviso-badge/AvisoBadge.jsx";
import FormularioEvento from "../../../components/formulario-evento/FormularioEvento.jsx";
import { avisoExito, confirmarEliminacion } from "../../../lib/alertas.js";
import {
  NOMBRES_MES, ABREV_MES, aClaveFecha, desdeClaveFecha, sumarDias, minutosDe, formatoHora,
  formatoFechaLarga, calcularSemestre, ahoraMexico,
} from "../../../lib/fechas.js";
import { TIPOS, AREAS, COLORES_TIPO, SEMESTRES, GRUPOS, PLANTELES, TURNOS, eventosIniciales, alcanceEvento } from "../../../data/calendario.js";
import { useSesion } from "../../../hooks/useSesion.js";
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
  horaInicio: "", horaFin: "", lugar: "", plantel: "", turno: "", formato: "punto", todoElDia: false,
  especifico: false, semestre: "", grupo: "",
};
const FORM_TIPO_VACIO = { id: null, etiqueta: "", color: "azul" };

function duracionTexto(ev) {
  if (!ev.horaInicio || !ev.horaFin) return null;
  const min = minutosDe(ev.horaFin) - minutosDe(ev.horaInicio);
  if (min <= 0) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} ${h === 1 ? "hora" : "horas"}`;
  return `${m} min`;
}

export default function Calendario({ soloLectura = false }) {

  const hoy = useMemo(() => ahoraMexico(), []); // fecha/hora real en zona MX
  const claveHoy = aClaveFecha(hoy);            // "YYYY-MM-DD" de hoy

  // El alumno tiene su datos (semestre/grupo/plantel/turno) fijo en los filtros,
  // ya que son los datos que la API devuelve. El resto filtra libremente (ej. admin y docente)
  const sesion = useSesion();
  const esAlumno = sesion.rol === "alumno";

  const [tipos, setTipos] = useState(TIPOS);                          // tipos de evento (CRUD)
  const [eventos, setEventos] = useState(() => eventosIniciales());   // eventos (CRUD)
  const [vista, setVista] = useState("mes");                          // vista activa
  const [fechaActual, setFechaActual] = useState(hoy);                // mes/fecha que muestra FC
  const [tituloVista, setTituloVista] = useState("");                 // título que da FC (semana/anual/lista)
  const [fechaSeleccionada, setFechaSeleccionada] = useState(claveHoy); // día resaltado
  const [mesSeleccionado, setMesSeleccionado] = useState(null);         // mes elegido en la vista anual
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroArea, setFiltroArea] = useState("todas");
  const [filtroSemestre, setFiltroSemestre] = useState(
    () => (esAlumno && sesion.semestre ? String(sesion.semestre) : "")
  );
  const [filtroGrupo, setFiltroGrupo] = useState(
    () => (esAlumno && sesion.grupo ? sesion.grupo : "")
  );
  const [filtroPlantel, setFiltroPlantel] = useState(
    () => (esAlumno && sesion.plantel?.nombre ? sesion.plantel.nombre : "")
  );
  const [filtroTurno, setFiltroTurno] = useState(
    () => (esAlumno && sesion.turno?.nombre ? sesion.turno.nombre : "")
  );
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [pickerAbierto, setPickerAbierto] = useState(false);            // selector de mes
  const [anioPicker, setAnioPicker] = useState(() => hoy.getFullYear());
  const [vistaMenu, setVistaMenu] = useState(false);                    // menú desplegable de vista
  
  const [panelAbierto, setPanelAbierto] = useState(false);

  // Info rápida
  const [popover, setPopover] = useState(null);         
  const [eventoSelId, setEventoSelId] = useState(null); 

  // Estado de los 3 modales
  const [modalEvento, setModalEvento] = useState(false);
  const [formEvento, setFormEvento] = useState(FORM_EVENTO_VACIO);
  const [eventoEditando, setEventoEditando] = useState(null);
  const [modalTipo, setModalTipo] = useState(false);
  const [formTipo, setFormTipo] = useState(FORM_TIPO_VACIO);

  // Referencias: a FullCalendar (para controlarlo) y a los desplegables.
  const calendarRef = useRef(null);
  const lienzoRef = useRef(null);
  const pickerRef = useRef(null);
  const vistaRef = useRef(null);
  const popoverRef = useRef(null);
  const asideRef = useRef(null);
  const clicTimer = useRef(null);
  const cierreHoverTimer = useRef(null);

  useEffect(() => {
    if (panelAbierto && window.matchMedia("(max-width: 1100px)").matches) {
      asideRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [panelAbierto]);

  // Acceso corto a la API de FullCalendar (prev, next, today, changeView...).
  const api = () => calendarRef.current?.getApi();

  useEffect(() => {
    const el = lienzoRef.current; 
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const observador = new ResizeObserver(() => api()?.updateSize());
    observador.observe(el);
    return () => observador.disconnect();
  }, [vista]);

  useEffect(() => {
    const alClicar = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerAbierto(false);
      if (vistaRef.current && !vistaRef.current.contains(e.target)) setVistaMenu(false);
    };
    document.addEventListener("mousedown", alClicar);
    return () => document.removeEventListener("mousedown", alClicar);
  }, []);

  const cerrarPopover = useCallback(() => {
    setPopover(null);
    setEventoSelId(null);
  }, []);

  const fijoRef = useRef(false);
  useEffect(() => {
    fijoRef.current = Boolean(popover?.fijo);
  }, [popover]);

  useEffect(() => {
    if (!popover) return undefined;
    const alClicar = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) cerrarPopover();
    };
    const alTecla = (e) => {
      if (e.key === "Escape") cerrarPopover();
    };
    document.addEventListener("mousedown", alClicar);
    document.addEventListener("keydown", alTecla);
    return () => {
      document.removeEventListener("mousedown", alClicar);
      document.removeEventListener("keydown", alTecla);
    };
  }, [popover, cerrarPopover]);

  // Mapa id -> tipo, para buscar color/etiqueta de un evento rápidamente.
  const tiposPorId = useMemo(() => {
    const mapa = new Map();
    for (const t of tipos) mapa.set(t.id, t);
    return mapa;
  }, [tipos]);

  const colorTipo = useCallback((id) => tiposPorId.get(id)?.color ?? "gris", [tiposPorId]);
  const etiquetaTipo = useCallback((id) => tiposPorId.get(id)?.etiqueta ?? "Sin tipo", [tiposPorId]);

  // Semestre (A/B) según el mes que se está viendo (insignia del encabezado).
  const semestre = calcularSemestre(fechaActual);

  // Eventos visibles tras aplicar los filtros de tipo y área.
  const eventosFiltrados = useMemo(() => {
    return eventos.filter((ev) => {
      if (filtroTipo !== "todos" && ev.tipo !== filtroTipo) return false;
      if (filtroArea !== "todas" && ev.area !== filtroArea) return false;
      if (filtroSemestre && ev.semestre != null && String(ev.semestre) !== filtroSemestre) return false;
      if (filtroGrupo && ev.grupo != null && ev.grupo !== filtroGrupo) return false;
      if (filtroPlantel && ev.plantel != null && ev.plantel !== filtroPlantel) return false;
      if (filtroTurno && ev.turno != null && ev.turno !== filtroTurno) return false;
      if (filtroFechaDesde && (ev.fechaFin || ev.fecha) < filtroFechaDesde) return false;
      if (filtroFechaHasta && ev.fecha > filtroFechaHasta) return false;
      return true;
    });
  }, [
    eventos, filtroTipo, filtroArea, filtroSemestre, filtroGrupo,
    filtroPlantel, filtroTurno, filtroFechaDesde, filtroFechaHasta,
  ]);

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
  }, [eventosFiltrados, colorTipo]);

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

  const eventosDelMes = useMemo(() => {
    if (!mesSeleccionado) return [];
    return eventosFiltrados
      .filter((ev) => ev.fecha.slice(0, 7) === mesSeleccionado)
      .sort(
        (a, b) =>
          a.fecha.localeCompare(b.fecha) || (a.horaInicio || "").localeCompare(b.horaInicio || "")
      );
  }, [eventosFiltrados, mesSeleccionado]);

  const esVistaFC = vista === "mes" || vista === "semana";
  const usaPicker = vista === "mes" || vista === "lista";
  const enAnual = vista === "anual";
  const mostrarMes = enAnual && Boolean(mesSeleccionado);
  const eventosPanel = mostrarMes ? eventosDelMes : eventosDelDia;
  const tituloPanel = mostrarMes
    ? `${NOMBRES_MES[Number(mesSeleccionado.slice(5, 7)) - 1]} ${mesSeleccionado.slice(0, 4)}`
    : fechaSeleccionada
      ? formatoFechaLarga(fechaSeleccionada)
      : "Selecciona un día";
  const hayFiltros = filtroTipo !== "todos" || filtroArea !== "todas" ||
    filtroFechaDesde !== "" || filtroFechaHasta !== "" ||
    (!esAlumno && (filtroSemestre !== "" || filtroGrupo !== "" || filtroPlantel !== "" || filtroTurno !== ""));

  const seleccionarDiaAnual = (clave) => {
    setFechaSeleccionada(clave);
    setMesSeleccionado(null);
  };

  const limpiarFiltros = () => {
    setFiltroTipo("todos");
    setFiltroArea("todas");
    setFiltroFechaDesde("");
    setFiltroFechaHasta("");
    if (!esAlumno) {
      setFiltroSemestre("");
      setFiltroGrupo("");
      setFiltroPlantel("");
      setFiltroTurno("");
    }
  };

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
    setMesSeleccionado(null);
    if (esVistaFC) api()?.today();
  };

  const mover = (delta) => {
    setMesSeleccionado(null);
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
    setMesSeleccionado(null);
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
    cerrarPopover();
  };

  // Clic en un día, se marca como seleccionado (resalta la celda + panel)
  const alClicarFecha = (arg) => setFechaSeleccionada(arg.dateStr.slice(0, 10));

  /* Clic en un evento:
       - 1 clic - seleccionarlo y mostrar la info rápida (popover).
       - 2 clics - abrir el modal de edición */
  const alClicarEvento = (arg) => {
    arg.jsEvent.preventDefault();
    const rect = arg.el.getBoundingClientRect();
    const original = arg.event.extendedProps.original;
    document.querySelectorAll(".fc-popover").forEach((el) => el.remove());
    if (!original) return;

    if (!soloLectura && arg.jsEvent.detail >= 2) {
      clearTimeout(clicTimer.current);
      cerrarPopover();
      setFechaSeleccionada(original.fecha);
      abrirEditarEvento(original);
      return;
    }
    clearTimeout(clicTimer.current);
    clearTimeout(cierreHoverTimer.current);
    clicTimer.current = setTimeout(() => {
      setFechaSeleccionada(original.fecha);
      setEventoSelId(arg.event.id);
      setPopover({ ev: original, x: rect.right, y: rect.top, fijo: true });
    }, 200);
  };

  const alEntrarEvento = useCallback((arg) => {
    if (fijoRef.current) return;
    clearTimeout(cierreHoverTimer.current);
    const original = arg.event.extendedProps.original;
    if (!original) return;
    const rect = arg.el.getBoundingClientRect();
    setPopover({ ev: original, x: rect.right, y: rect.top, fijo: false });
  }, []);

  const alSalirEvento = useCallback(() => {
    if (fijoRef.current) return;
    clearTimeout(cierreHoverTimer.current);
    cierreHoverTimer.current = setTimeout(cerrarPopover, 280);
  }, [cerrarPopover]);

  const claseDiaSeleccionado = useCallback(
    (arg) => (aClaveFecha(arg.date) === fechaSeleccionada ? "cal-fc-sel" : ""),
    [fechaSeleccionada]
  );

  const claseEventoSeleccionado = useCallback(
    (arg) => (arg.event.id === eventoSelId ? "cal-fc-ev-sel" : ""),
    [eventoSelId]
  );

  // CRUD
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
      horaFin: ev.horaFin || "", lugar: ev.lugar || "", plantel: ev.plantel ?? "",
      turno: ev.turno ?? "", formato: ev.formato || "punto",
      todoElDia: !ev.horaInicio,
      especifico: ev.semestre != null || ev.grupo != null,
      semestre: ev.semestre ?? "", grupo: ev.grupo ?? "",
    });
    setModalEvento(true);
  };


  const guardarEvento = (e) => {
    e.preventDefault();
    if (!formEvento.fecha) return;
    const { todoElDia, especifico, ...resto } = formEvento;
    const datos = {
      ...resto,
      titulo: formEvento.titulo.trim(),
      lugar: formEvento.lugar.trim(),
      fechaFin: formEvento.fechaFin || null,
      horaInicio: todoElDia ? "" : formEvento.horaInicio,
      horaFin: todoElDia ? "" : formEvento.horaFin,
      formato: todoElDia ? "rango" : "punto",
      plantel: formEvento.plantel || null,
      turno: formEvento.turno || null,
      semestre: especifico && formEvento.semestre ? Number(formEvento.semestre) : null,
      grupo: especifico && formEvento.grupo ? formEvento.grupo : null,
    };
    if (eventoEditando) {
      setEventos((prev) => prev.map((ev) => (ev.id === eventoEditando ? { ...ev, ...datos } : ev)));
    } else {
      setEventos((prev) => [...prev, { ...datos, id: Date.now() }]);
    }
    setFechaSeleccionada(datos.fecha);
    api()?.gotoDate(datos.fecha);
    setModalEvento(false);
    avisoExito(eventoEditando ? "Evento actualizado" : "Evento creado");
  };

  const pedirEliminar = async (ev) => {
    cerrarPopover();
    const { isConfirmed } = await confirmarEliminacion(ev.titulo);
    if (!isConfirmed) return;
    setEventos((prev) => prev.filter((e) => e.id !== ev.id));
    avisoExito("Evento eliminado");
  };

  const eliminarDesdeEdicion = () => {
    const ev = eventos.find((e) => e.id === eventoEditando);
    setModalEvento(false);
    if (ev) pedirEliminar(ev);
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
    setFiltroTipo((prev) => (prev === tipo.id ? "todos" : prev));
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
          {soloLectura && (
            <AvisoBadge texto="lectura" />
          )}
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

              {!soloLectura && (
                <>
                  <button type="button" className="boton boton--fantasma" disabled title="Disponible próximamente">
                    <Download size={16} />
                    Exportar
                  </button>
                  <button type="button" className="boton boton--primario" onClick={abrirNuevoEvento}>
                    <Plus size={16} />
                    Nuevo evento
                  </button>
                </>
              )}

              {/* Mostrar/ocultar el panel lateral (simbología, tipos, filtros) */}
              <button
                type="button"
                className={`boton boton--fantasma ${styles["barra__panel-btn"]}`}
                aria-pressed={panelAbierto}
                onClick={() => setPanelAbierto((v) => !v)}
                title={panelAbierto ? "Ocultar panel" : "Mostrar panel"}
              >
                <PanelRight size={16} />
                Panel
                {hayFiltros && !panelAbierto && <span className={styles["barra__panel-punto"]} />}
              </button>
            </div>
          </div>

          {/* ---- EL CALENDARIO ----
               Mes y Semana las dibuja FullCalendar; Anual y Lista son
               componentes propios */}
          {esVistaFC ? (
            <div className={`tarjeta ${styles["lienzo"]}`} ref={lienzoRef}>
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
                  eventClassNames={claseEventoSeleccionado}
                  datesSet={alCambiarFechas}
                  dateClick={alClicarFecha}
                  eventClick={alClicarEvento}
                  eventMouseEnter={alEntrarEvento}
                  eventMouseLeave={alSalirEvento}
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
              mesSeleccionado={mesSeleccionado}
              onSeleccionarDia={seleccionarDiaAnual}
              onSeleccionarMes={setMesSeleccionado}
            />
          ) : (
            <VistaLista
              eventos={eventosFiltrados}
              fechaActual={fechaActual}
              colorTipo={colorTipo}
              etiquetaTipo={etiquetaTipo}
              onSeleccionarDia={setFechaSeleccionada}
              onEditar={abrirEditarEvento}
              onEliminar={pedirEliminar}
              soloLectura={soloLectura}
            />
          )}

          {/* PANEL DE EVENTOS DEL DÍA SELECCIONADO.
              En la vista Lista no se muestra: la lista ya detalla los eventos. */}
          {vista !== "lista" && (
          <div className={`tarjeta ${styles["panel-dia"]}`}>
            <div className={styles["panel-dia__cabecera"]}>
              <h3 className={styles["panel-dia__titulo"]}>{tituloPanel}</h3>
              <span className={styles["panel-dia__conteo"]}>
                {eventosPanel.length} {eventosPanel.length === 1 ? "evento" : "eventos"}
              </span>
            </div>

            {eventosPanel.length === 0 ? (
              <p className={styles["panel-dia__vacio"]}>
                {mostrarMes ? "No hay eventos en este mes." : "No hay eventos programados para este día."}
              </p>
            ) : (
              <div className={styles["tabla-envoltura"]}>
                <table className={styles["tabla"]}>
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th>Evento</th>
                      <th>Área</th>
                      <th>Lugar</th>
                      <th>Tipo</th>
                      {!soloLectura && <th className={styles["tabla__acciones-col"]}>Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {eventosPanel.map((ev) => (
                      <tr key={ev.id}>
                        <td>
                          <span className={styles["tabla__hora"]}>
                            <span className={`${styles["tabla__bolita"]} ${styles[`tabla__bolita--${colorTipo(ev.tipo)}`]}`} />
                            <span>
                              {ev.horaInicio ? formatoHora(ev.horaInicio) : "Todo el día"}
                              {mostrarMes && (
                                <small className={styles["tabla__dia"]}>
                                  {Number(ev.fecha.slice(8, 10))} {ABREV_MES[Number(ev.fecha.slice(5, 7)) - 1].toLowerCase()}
                                </small>
                              )}
                            </span>
                          </span>
                        </td>
                        <td className={styles["tabla__evento"]}>
                          {ev.titulo}
                          <small className={styles["tabla__sub"]}>{alcanceEvento(ev)}</small>
                        </td>
                        <td className={styles["tabla__tenue"]}>{ev.area}</td>
                        <td className={styles["tabla__tenue"]}>
                          {ev.lugar || "—"}
                          <small className={styles["tabla__sub"]}>
                            {ev.plantel || "Todos los planteles"}{ev.turno ? ` · ${ev.turno}` : ""}
                          </small>
                        </td>
                        <td>
                          <span className={`etiqueta etiqueta--${colorTipo(ev.tipo)}`}>
                            {etiquetaTipo(ev.tipo)}
                          </span>
                        </td>
                        {!soloLectura && (
                          <td>
                            <div className={styles["tabla__acciones"]}>
                              <button type="button" onClick={() => abrirEditarEvento(ev)} aria-label="Editar" title="Editar">
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                className={styles["tabla__borrar"]}
                                onClick={() => pedirEliminar(ev)}
                                aria-label="Eliminar"
                                title="Eliminar"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}
        </div>

        <div
          className={`${styles["panel-respaldo"]} ${panelAbierto ? styles["panel-respaldo--visible"] : ""}`}
          onClick={() => setPanelAbierto(false)}
          aria-hidden="true"
        />

        {/* ---- PANEL LATERAL: simbología, tipos de evento y filtros ---- */}
        <aside
          ref={asideRef}
          className={`${styles["calendario__aside"]} ${panelAbierto ? styles["calendario__aside--abierto"] : ""}`}
          aria-hidden={!panelAbierto}
        >
          {/* Encabezado del panel con X para cerrarlo */}
          <div className={styles["panel-cab"]}>
            <span className={styles["panel-cab__titulo"]}>Panel</span>
            <button
              type="button"
              className={styles["panel-cab__cerrar"]}
              onClick={() => setPanelAbierto(false)}
              aria-label="Cerrar panel"
            >
              <X size={18} />
            </button>
          </div>

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

          {/* Tipos de evento: lista con crear, editar y eliminar — solo admin */}
          {!soloLectura && (
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
          )}

          {/* Filtros rápidos */}
          <article className="tarjeta">
            <div className="tarjeta__cabecera">
              <div className="tarjeta__titulo">
                <Filter size={16} />
                Filtros rápidos
              </div>
              {hayFiltros && (
                <button type="button" className="tarjeta__enlace" onClick={limpiarFiltros}>
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

              <label className="formulario__campo">
                <span className="formulario__etiqueta">Semestre</span>
                <select value={filtroSemestre} disabled={esAlumno} onChange={(e) => setFiltroSemestre(e.target.value)}>
                  <option value="">Todos</option>
                  {SEMESTRES.map((s) => (
                    <option key={s} value={s}>{s}.º</option>
                  ))}
                </select>
              </label>

              <label className="formulario__campo">
                <span className="formulario__etiqueta">Grupo</span>
                <select value={filtroGrupo} disabled={esAlumno} onChange={(e) => setFiltroGrupo(e.target.value)}>
                  <option value="">Todos</option>
                  {GRUPOS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </label>

              <label className="formulario__campo">
                <span className="formulario__etiqueta">Plantel</span>
                {esAlumno ? (
                  <select value={filtroPlantel} disabled>
                    <option value={filtroPlantel}>{filtroPlantel || "Todos"}</option>
                  </select>
                ) : (
                  <select value={filtroPlantel} onChange={(e) => setFiltroPlantel(e.target.value)}>
                    <option value="">Todos</option>
                    {PLANTELES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                )}
              </label>

              <label className="formulario__campo">
                <span className="formulario__etiqueta">Turno</span>
                <select value={filtroTurno} disabled={esAlumno} onChange={(e) => setFiltroTurno(e.target.value)}>
                  <option value="">Todos</option>
                  {TURNOS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>

              <div className="formulario__fila">
                <label className="formulario__campo">
                  <span className="formulario__etiqueta">Desde</span>
                  <input type="date" value={filtroFechaDesde} onChange={(e) => setFiltroFechaDesde(e.target.value)} />
                </label>
                <label className="formulario__campo">
                  <span className="formulario__etiqueta">Hasta</span>
                  <input type="date" value={filtroFechaHasta} onChange={(e) => setFiltroFechaHasta(e.target.value)} />
                </label>
              </div>
            </div>
          </article>
        </aside>
      </div>

      {/* Info rápida del evento */}
      {popover && (
        <div
          ref={popoverRef}
          className={styles["pop-evento"]}
          style={{
            left: Math.min(popover.x + 4, window.innerWidth - 282),
            top: Math.max(8, Math.min(popover.y, window.innerHeight - 190)),
          }}
          onMouseEnter={() => clearTimeout(cierreHoverTimer.current)}
          onMouseLeave={() => {
            if (!popover.fijo) {
              clearTimeout(cierreHoverTimer.current);
              cierreHoverTimer.current = setTimeout(cerrarPopover, 280);
            }
          }}
        >
          <div className={styles["pop-evento__cab"]}>
            <span className={`${styles["pop-evento__punto"]} ${styles[`pop-evento__punto--${colorTipo(popover.ev.tipo)}`]}`} />
            <span className={styles["pop-evento__titulo"]}>{popover.ev.titulo}</span>
            <div className={styles["pop-evento__acciones"]}>
              {!soloLectura && (
                <>
                  <button
                    type="button"
                    title="Editar"
                    onClick={() => { const ev = popover.ev; cerrarPopover(); abrirEditarEvento(ev); }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className={styles["pop-evento__borrar"]}
                    title="Eliminar"
                    onClick={() => pedirEliminar(popover.ev)}
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
              <button type="button" title="Cerrar" onClick={cerrarPopover}>
                <X size={15} />
              </button>
            </div>
          </div>

          <ul className={styles["pop-evento__datos"]}>
            <li>
              <Clock size={14} />
              {popover.ev.horaInicio
                ? `${formatoHora(popover.ev.horaInicio)}${popover.ev.horaFin ? ` – ${formatoHora(popover.ev.horaFin)}` : ""}`
                : "Todo el día"}
            </li>
            {duracionTexto(popover.ev) && (
              <li>
                <Hourglass size={14} />
                {duracionTexto(popover.ev)}
              </li>
            )}
            {popover.ev.lugar && (
              <li>
                <MapPin size={14} />
                {popover.ev.lugar}
              </li>
            )}
            <li>
              <Tag size={14} />
              <span className={`etiqueta etiqueta--${colorTipo(popover.ev.tipo)}`}>
                {etiquetaTipo(popover.ev.tipo)}
              </span>
            </li>
          </ul>
        </div>
      )}

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
        <FormularioEvento
          id="form-evento-calendario"
          form={formEvento}
          tipos={tipos}
          onChange={(campo, valor) => setFormEvento((prev) => ({ ...prev, [campo]: valor }))}
          onSubmit={guardarEvento}
        />
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
