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
  ChevronDown, Plus, CalendarSync, Pencil, Trash2, Filter, Tag,
  PanelRight, X, Clock, MapPin, Hourglass, Check, Eye,
} from "lucide-react";
import Modal from "../../../components/modal/Modal.jsx";
import FormularioEvento from "../../../components/formulario-evento/FormularioEvento.jsx";
import { avisoExito, confirmarEliminacion, confirmarAccion } from "../../../lib/alertas.js";
import {
  NOMBRES_MES, ABREV_MES, aClaveFecha, desdeClaveFecha, sumarDias, minutosDe, formatoHora,
  formatoFechaLarga, calcularSemestre, ahoraMexico, rangoSemana,
} from "../../../lib/fechas.js";
import { AREAS, SEMESTRES, GRUPOS, TURNOS, alcanceEvento } from "../../../data/calendario.js";
import {
  listarCalendarios, listarTipos, listarEventos,
  crearEvento, actualizarEvento, eliminarEvento,
  crearTipo, actualizarTipo, eliminarTipo,
} from "../../../services/eventosService.js";
import SelectorPlantel from "../../../components/selector-plantel/SelectorPlantel.jsx";
import { avisoError } from "../../../lib/alertas.js";
import { useSesion } from "../../../hooks/useSesion.js";
import { usePreferencia } from "../../../hooks/usePreferencia.js";
import VistaAnual from "./vistas/VistaAnual.jsx";
import VistaLista from "./vistas/VistaLista.jsx";
import VistaMesMovil from "./vistas/VistaMesMovil.jsx";
import { urlAutorizacion, verificarVinculo, vincular, desvincular } from "../../../services/googleCalendarService.js";
import VistaSemanaMovil from "./vistas/VistaSemanaMovil.jsx";
import styles from "./calendario.module.css";
import "./fullcalendar.css";

const COLOR_GRIS = "#97a3b6";

function randomColor() {
  return "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0").toUpperCase();
}

const VISTAS = [
  { id: "mes", etiqueta: "Mes", icono: CalendarDays, fc: "dayGridMonth" },
  { id: "semana", etiqueta: "Semana", icono: CalendarRange, fc: "timeGridWeek" },
  { id: "anual", etiqueta: "Anual", icono: LayoutGrid, fc: "multiMonthYear" },
  { id: "lista", etiqueta: "Lista", icono: List, fc: "listMonth" },
];

/* Valores iniciales de los formularios (evento nuevo y tipo nuevo). */
const FORM_EVENTO_VACIO = {
  titulo: "", tipo: "", area: "", fecha: "", fechaFin: "",
  horaInicio: "", horaFin: "", lugar: "", plantel: "", turno: "", formato: "punto", todoElDia: false,
  especifico: false, semestre: "", grupo: "", agregarAGoogleCalendar: false,
};

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

export default function Calendario({ soloLectura = false, publico = false }) {

  const hoy = useMemo(() => ahoraMexico(), []); // fecha/hora real en zona MX
  const claveHoy = aClaveFecha(hoy);            // "YYYY-MM-DD" de hoy

  // El alumno tiene su datos (semestre/grupo/plantel/turno) fijo en los filtros,
  // ya que son los datos que la API devuelve. El resto filtra libremente (ej. admin y docente)
  const sesion = useSesion();
  const esAlumno = sesion.rol === "alumno";
  const esDocente = sesion.rol === "docente";
  const esSuperusuario = sesion.rol === "superusuario";
  const esAdmin = sesion.rol === "admin";

  // los roles de solo lectura nunca editan - el admin/superusuario sí.
  const lectura = soloLectura || publico;

  const misAsignaciones = useMemo(() => {
    if (!esAdmin) return [];
    return (sesion.planteles || [])
      .map((a) => ({ plantel: a.plantel?.nombre, turno: a.turno?.nombre }))
      .filter((a) => a.plantel);
  }, []);
  const misPlanteles = useMemo(() => [...new Set(misAsignaciones.map((a) => a.plantel))], [misAsignaciones]);
  const misTurnos = useMemo(() => [...new Set(misAsignaciones.map((a) => a.turno).filter(Boolean))], [misAsignaciones]);

  // Planteles/turnos a los que el usuario puede filtrar en el calendario: 
  // el alumno tiene 1 fijo;
  // el docente los que tenga asignados sea 1 o 2 maximo 
  // admin/superusuario, sin límite (por ahora)
  const plantelesPermitidos = useMemo(() => {
    if (esAlumno) return sesion.plantel?.nombre ? [sesion.plantel.nombre] : [];
    if (esDocente) return [...new Set((sesion.planteles || []).map((a) => a.plantel?.nombre).filter(Boolean))];
    return [];
  }, []);
  const turnosPermitidos = useMemo(() => {
    if (esAlumno) return sesion.turno?.nombre ? [sesion.turno.nombre] : [];
    if (esDocente) return [...new Set((sesion.planteles || []).map((a) => a.turno?.nombre).filter(Boolean))];
    return [];
  }, []);

  const [tipos, setTipos] = useState([]);                             // tipos de evento (desde la BD)
  const [eventos, setEventos] = useState([]);                         // eventos (desde la BD)
  const [calendarios, setCalendarios] = useState([]);                 // catálogo de calendarios
  const [calendarioActivo, setCalendarioActivo] = useState(null);     // id del calendario en pantalla
  const [vista, setVista] = usePreferencia("calendario:vista", "mes"); // vista activa (recordada)
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
  
  const [filtroPlantel, setFiltroPlantel] = useState("");
  const [filtroTurno, setFiltroTurno] = useState("");
  // Buscador del superusuario = solo calendario general: nombre = generales + ese plantel.
  // (no aparecen todos los eventos) para no saturar el calendario
  const [vistaPlantel, setVistaPlantel] = useState("");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [pickerAbierto, setPickerAbierto] = useState(false);            // selector de mes
  const [anioPicker, setAnioPicker] = useState(() => hoy.getFullYear());
  const [vistaMenu, setVistaMenu] = useState(false);                    // menú desplegable de vista
  
  const [panelAbierto, setPanelAbierto] = usePreferencia("calendario:panel", false);
  const [filtrosModalAbierto, setFiltrosModalAbierto] = useState(false);
  const [esMobil, setEsMobil] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches
  );

  // Info rápida
  const [popover, setPopover] = useState(null);
  const [eventoSelId, setEventoSelId] = useState(null);
  const [detalleEvento, setDetalleEvento] = useState(null);  // modal de detalles (móvil)

  // Estado de los 3 modales
  const [modalEvento, setModalEvento] = useState(false);
  const [formEvento, setFormEvento] = useState(FORM_EVENTO_VACIO);
  const [eventoEditando, setEventoEditando] = useState(null);

  // Gestión de tipos de evento (simbología)
  const [tipoEditandoId, setTipoEditandoId] = useState(null);
  const [editNombre, setEditNombre] = useState("");
  const [editColor, setEditColor] = useState("#64748B");
  const [formTipoVisible, setFormTipoVisible] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoColor, setNuevoColor] = useState(randomColor);
  const [nuevoPlantelId, setNuevoPlantelId] = useState("");

  // null = verificando, false = no vinculado, { vinculado: true, email } = vinculado
  const [calVinculado, setCalVinculado] = useState(null);

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
    if (!panelAbierto) return;
    if (!window.matchMedia("(max-width: 1100px)").matches) return;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") setPanelAbierto(false); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [panelAbierto]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const handler = (e) => setEsMobil(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (publico || !sesion?.id_usuario) return;
    verificarVinculo()
      .then((data) => setCalVinculado(data.vinculado ? data : false))
      .catch(() => setCalVinculado(false));
  }, [publico, sesion?.id_usuario]);

  useEffect(() => {
    if (publico || !sesion?.id_usuario) return;
    const onMessage = async (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'google-calendar-code') return;
      const { code, error } = event.data;
      if (error) { avisoError('Autorización rechazada por Google.'); return; }
      if (!code) return;
      try {
        const resultado = await vincular(code);
        setCalVinculado({ vinculado: true, email: resultado.email ?? null });
        avisoExito('Google Calendar vinculado correctamente.');
      } catch (e) {
        avisoError(e.message || 'No se pudo vincular Google Calendar.');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [publico, sesion?.id_usuario]);

  const abrirVinculacionGoogle = () => {
    const w = 520, h = 620;
    const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
    const top = Math.round(window.screenY + (window.outerHeight - h) / 2);
    const popup = window.open(
      urlAutorizacion(),
      'google-calendar-vincular',
      `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );
    if (!popup) avisoError('Permite ventanas emergentes para vincular Google Calendar.');
  };

  const desconectarCalendar = async () => {
    const emailMostrar = calVinculado?.email ? ` (${calVinculado.email})` : '';
    const result = await confirmarAccion({
      titulo: 'Desconectar Google Calendar',
      html: `Los eventos ya sincronizados permanecerán en tu Google Calendar${emailMostrar}.`,
      confirmar: 'Desconectar',
      peligro: true,
    });
    if (!result.isConfirmed) return;
    try {
      await desvincular();
      setCalVinculado(false);
      avisoExito('Google Calendar desconectado.');
    } catch {
      avisoError('No se pudo desconectar Google Calendar.');
    }
  };

  // Acceso corto a la API de FullCalendar (prev, next, today, changeView...).
  const api = () => calendarRef.current?.getApi();

  const cargarEventos = useCallback(async (idCal) => {
    if (!idCal) return;
    try {
      setEventos(await listarEventos(idCal, { publico, plantelFiltro: vistaPlantel }));
    } catch (e) {
      avisoError(e.message || "No se pudieron cargar los eventos.");
    }
  }, [publico, vistaPlantel]);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const [cals, tps] = await Promise.all([listarCalendarios(), listarTipos()]);
        if (!activo) return;
        setCalendarios(cals);
        setTipos(tps);
        setCalendarioActivo((prev) => prev ?? (cals[0]?.id ?? null));
      } catch (e) {
        if (activo) avisoError(e.message || "No se pudo cargar el calendario.");
      }
    })();
    return () => { activo = false; };
  }, []);

  useEffect(() => {
    if (calendarioActivo) cargarEventos(calendarioActivo);
  }, [calendarioActivo, cargarEventos]);

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

  const colorTipo = useCallback((id) => tiposPorId.get(id)?.color ?? COLOR_GRIS, [tiposPorId]);
  const etiquetaTipo = useCallback((id) => tiposPorId.get(id)?.etiqueta ?? "Sin tipo", [tiposPorId]);

  // Semestre (A/B) según el mes que se está viendo (insignia del encabezado).
  const semestre = calcularSemestre(fechaActual);

  // El admin solo crea en el escolarizado, el superusuario en cualquiera, el resto no crea
  const calActivo = useMemo(
    () => calendarios.find((c) => c.id === calendarioActivo) || null,
    [calendarios, calendarioActivo]
  );
  const tiposParaCrear = useMemo(
    () => esAdmin ? tipos.filter((t) => !t.es_global) : tipos,
    [tipos, esAdmin]
  );

  const tiposSimbologia = useMemo(() => {
    if (!esSuperusuario) return tipos;
    if (!vistaPlantel) return tipos.filter((t) => t.es_global);
    return tipos.filter((t) => t.es_global || t.plantel === vistaPlantel);
  }, [tipos, esSuperusuario, vistaPlantel]);
  const tienesTipos = tiposParaCrear.length > 0;
  const puedeCrear = !lectura && tienesTipos && (esSuperusuario || (esAdmin && calActivo?.clave === "escolarizado"));

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
      const color = colorTipo(ev.tipo);
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
    if (vista === "semana") {
      if (esMobil) {
        const inicio = sumarDias(fechaActual, -fechaActual.getDay());
        return rangoSemana(inicio, sumarDias(inicio, 6));
      }
      return tituloVista.charAt(0).toUpperCase() + tituloVista.slice(1);
    }
    if (vista === "anual") {
      const ciclo = fechaActual.getMonth() >= 7 ? fechaActual.getFullYear() : fechaActual.getFullYear() - 1;
      return `Ciclo ${ciclo} – ${ciclo + 1}`;
    }
    return `${NOMBRES_MES[fechaActual.getMonth()]} ${fechaActual.getFullYear()}`; // mes y lista
  }, [vista, fechaActual, tituloVista, esMobil]);

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
    } else if (api()) {
      // FullCalendar montado (escritorio): él gestiona prev/next y avisa por datesSet.
      api()[delta < 0 ? "prev" : "next"]();
    } else if (vista === "semana") {
      // Móvil: no hay FullCalendar; movemos la fecha por semanas o meses.
      setFechaActual((x) => sumarDias(x, delta * 7));
    } else {
      setFechaActual((x) => new Date(x.getFullYear(), x.getMonth() + delta, 1));
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
    if (api()) api().gotoDate(new Date(anioPicker, mes, 1));
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

    if (!lectura && original.puede_editar && arg.jsEvent.detail >= 2) {
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
    cierreHoverTimer.current = setTimeout(() => {
      if (popoverRef.current?.matches(':hover')) return;
      cerrarPopover();
    }, 280);
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
    setFormEvento({
      ...FORM_EVENTO_VACIO,
      fecha: fechaSeleccionada || claveHoy,
      tipo: tiposParaCrear[0]?.id || "",
      plantel: esAdmin ? (misAsignaciones[0]?.plantel || "") : "",
      turno: esAdmin ? (misAsignaciones[0]?.turno || "") : "",
      agregarAGoogleCalendar: Boolean(calVinculado?.vinculado),
    });
    setModalEvento(true);
  };

  const abrirEditarEvento = (ev) => {
    setEventoEditando(ev.id);
    setFormEvento({
      titulo: ev.titulo, tipo: ev.tipo, area: ev.area || "", fecha: ev.fecha,
      fechaFin: ev.fechaFin || "", horaInicio: ev.horaInicio || "",
      horaFin: ev.horaFin || "", lugar: ev.lugar || "", plantel: ev.plantel ?? "",
      turno: ev.turno ?? "", formato: ev.formato || "punto",
      todoElDia: !ev.horaInicio,
      especifico: ev.semestre != null || ev.grupo != null,
      semestre: ev.semestre ?? "", grupo: ev.grupo ?? "",
    });
    setModalEvento(true);
  };

  const guardarEvento = async (e) => {
    e.preventDefault();
    if (!formEvento.fecha || !calendarioActivo) return;
    const { todoElDia, especifico, formato, agregarAGoogleCalendar, ...resto } = formEvento;
    const datos = {
      ...resto,
      id_calendario: calendarioActivo,
      titulo: formEvento.titulo.trim(),
      lugar: formEvento.lugar.trim(),
      area: formEvento.area || "",
      fechaFin: formEvento.fechaFin || null,
      horaInicio: todoElDia ? "" : formEvento.horaInicio,
      horaFin: todoElDia ? "" : formEvento.horaFin,
      plantel: formEvento.plantel || null,
      turno: formEvento.turno || null,
      semestre: especifico && formEvento.semestre ? Number(formEvento.semestre) : null,
      grupo: especifico && formEvento.grupo ? formEvento.grupo : null,
    };
    try {
      if (eventoEditando) {
        await actualizarEvento(eventoEditando, datos);
      } else {
        await crearEvento(datos, { agregarAGoogleCalendar });
      }
      await cargarEventos(calendarioActivo);
      setFechaSeleccionada(datos.fecha);
      api()?.gotoDate(datos.fecha);
      setModalEvento(false);
      avisoExito(eventoEditando ? "Evento actualizado" : "Evento creado");
    } catch (err) {
      avisoError(err.message || "No se pudo guardar el evento.");
    }
  };

  const pedirEliminar = async (ev) => {
    cerrarPopover();
    const { isConfirmed } = await confirmarEliminacion(ev.titulo);
    if (!isConfirmed) return;
    try {
      await eliminarEvento(ev.id);
      await cargarEventos(calendarioActivo);
      avisoExito("Evento eliminado");
    } catch (err) {
      avisoError(err.message || "No se pudo eliminar el evento.");
    }
  };

  const eliminarDesdeEdicion = () => {
    const ev = eventos.find((e) => e.id === eventoEditando);
    setModalEvento(false);
    if (ev) pedirEliminar(ev);
  };

  // CRUD de tipos de evento
  const puedeGestionarTipos = !lectura && (esSuperusuario || esAdmin);

  const iniciarEdicionTipo = (t) => {
    setTipoEditandoId(t.id);
    setEditNombre(t.etiqueta);
    setEditColor(t.color);
    setFormTipoVisible(false);
  };

  const guardarEdicionTipo = async (id) => {
    try {
      const actualizado = await actualizarTipo(id, { nombre: editNombre.trim(), color_hex: editColor });
      setTipos((prev) => prev.map((t) => t.id === id
        ? { ...t, etiqueta: actualizado.etiqueta, color: actualizado.color }
        : t
      ));
      setTipoEditandoId(null);
    } catch (err) {
      avisoError(err.message || "No se pudo actualizar el tipo.");
    }
  };

  const pedirEliminarTipo = async (t) => {
    const { isConfirmed } = await confirmarEliminacion(t.etiqueta);
    if (!isConfirmed) return;
    try {
      await eliminarTipo(t.id);
      setTipos((prev) => prev.filter((x) => x.id !== t.id));
    } catch (err) {
      avisoError(err.message || "No se pudo eliminar el tipo.");
    }
  };

  const guardarNuevoTipo = async () => {
    if (!nuevoNombre.trim()) return;
    try {
      const plantel_id = esAdmin
        ? (nuevoPlantelId || (sesion.planteles?.[0]?.plantel?.id ?? null))
        : undefined;
      const nuevo = await crearTipo({ nombre: nuevoNombre.trim(), color_hex: nuevoColor, plantel_id });
      setTipos((prev) => [...prev, nuevo]);
      setNuevoNombre("");
      setNuevoColor(randomColor());
      setNuevoPlantelId("");
      setFormTipoVisible(false);
    } catch (err) {
      avisoError(err.message || "No se pudo crear el tipo.");
    }
  };

  return (
    <div className={styles["calendario"]}>
      {/* ENCABEZADO: selector de calendario */}
      <header className={styles["calendario__encabezado"]}>
        <div>
          {calendarios.length > 0 ? (
            <select
              className={styles["calendario__titulo-selector"]}
              value={calendarioActivo ?? ""}
              onChange={(e) => setCalendarioActivo(Number(e.target.value))}
              aria-label="Seleccionar calendario"
            >
              {calendarios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} · {c.ciclo}
                </option>
              ))}
            </select>
          ) : (
            <h2 className={styles["calendario__titulo"]}>Calendario institucional</h2>
          )}
          <span className={`etiqueta ${semestre.letra === "A" ? "etiqueta--marino" : "etiqueta--azul"} ${styles["calendario__semestre"]}`}>
            SEMESTRE {semestre.ciclo}-{semestre.letra}
          </span>
          {lectura && (
            <span className={styles["calendario__lectura"]} title="Solo lectura">
              <Eye size={13} />
              Solo lectura
            </span>
          )}
        </div>

        {/* Buscador del superusuario: por defecto tiene el "Calendario general": al elegir un
            plantel se suman sus eventos a los generales */}
        {esSuperusuario && (
          <div className={styles["calendario__vista-plantel"]}>
            <span>Mostrar</span>
            <SelectorPlantel
              value={vistaPlantel}
              onChange={setVistaPlantel}
              textoTodos="Calendario general"
            />
          </div>
        )}
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

              {!publico && sesion?.id_usuario && (
                calVinculado?.vinculado ? (
                  <button
                    type="button"
                    className="boton boton--fantasma"
                    onClick={desconectarCalendar}
                    aria-label="Google Calendar vinculado — clic para desconectar"
                    title={`Google Calendar vinculado${calVinculado.email ? ` como ${calVinculado.email}` : ''} — clic para desconectar`}
                  >
                    <Check size={16} />
                    {calVinculado.email
                      ? calVinculado.email.split('@')[0]
                      : 'Google Calendar'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="boton boton--fantasma"
                    onClick={abrirVinculacionGoogle}
                    disabled={calVinculado === null}
                    aria-label="Vincular Google Calendar"
                    title="Sincroniza los eventos con tu Google Calendar"
                  >
                    <CalendarSync size={16} />
                    {calVinculado === null ? '…' : 'Vincular Google Calendar'}
                  </button>
                )
              )}
              {puedeCrear && (
                <button type="button" className="boton boton--primario" onClick={abrirNuevoEvento}>
                  <Plus size={16} />
                  Nuevo evento
                </button>
              )}
              {!lectura && esAdmin && calActivo?.clave === "escolarizado" && !tienesTipos && (
                <span className={styles["aviso-sin-tipos"]}>
                  Antes de crear eventos, agrega un tipo de evento
                </span>
              )}

              {/* Filtros rápidos — abre modal */}
              <button
                type="button"
                className={`boton boton--fantasma ${styles["barra__panel-btn"]}`}
                onClick={() => setFiltrosModalAbierto(true)}
                aria-label="Filtros rápidos"
                title="Filtros rápidos"
              >
                <Filter size={16} />
                Filtros
                {hayFiltros && <span className={styles["barra__panel-punto"]} />}
              </button>

              {/* Mostrar/ocultar el panel lateral (simbología) */}
              <button
                type="button"
                className={`boton boton--fantasma ${styles["barra__panel-btn"]}`}
                aria-pressed={panelAbierto}
                onClick={() => setPanelAbierto((v) => !v)}
                aria-label="Simbología"
                title={panelAbierto ? "Ocultar simbología" : "Mostrar simbología"}
              >
                <PanelRight size={16} />
                Simbología
              </button>
            </div>
          </div>

          {/* ---- EL CALENDARIO ----
               Mes y Semana las dibuja FullCalendar; Anual y Lista son
               componentes propios */}
          {esVistaFC ? (
            esMobil && vista === "mes" ? (
              <div className={styles["lienzo"]}>
                <VistaMesMovil
                  fechaActual={fechaActual}
                  eventosPorDia={eventosPorDia}
                  colorTipo={colorTipo}
                  etiquetaTipo={etiquetaTipo}
                  claveHoy={claveHoy}
                  fechaSeleccionada={fechaSeleccionada}
                  onSeleccionarDia={setFechaSeleccionada}
                  soloLectura={lectura}
                  onEditar={abrirEditarEvento}
                  onEliminar={pedirEliminar}
                />
              </div>
            ) : esMobil && vista === "semana" ? (
              <div className={styles["lienzo"]}>
                <VistaSemanaMovil
                  fechaActual={fechaActual}
                  eventosPorDia={eventosPorDia}
                  colorTipo={colorTipo}
                  etiquetaTipo={etiquetaTipo}
                  claveHoy={claveHoy}
                  fechaSeleccionada={fechaSeleccionada}
                  onSeleccionarDia={setFechaSeleccionada}
                  soloLectura={lectura}
                  onEditar={abrirEditarEvento}
                  onEliminar={pedirEliminar}
                  onVerDetalle={setDetalleEvento}
                />
              </div>
            ) : (
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
            )
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
              soloLectura={lectura}
            />
          )}

          {/* PANEL DE EVENTOS DEL DÍA SELECCIONADO.
              En la vista Lista no se muestra: la lista ya detalla los eventos.
              En mobile vista mes tampoco: VistaMesMovil lo maneja internamente. */}
          {vista !== "lista" && !(esMobil && (vista === "mes" || vista === "semana")) && (
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
                      {!lectura && <th className={styles["tabla__acciones-col"]}>Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {eventosPanel.map((ev) => (
                      <tr key={ev.id}>
                        <td>
                          <span className={styles["tabla__hora"]}>
                            <span className={styles["tabla__bolita"]} style={{ backgroundColor: colorTipo(ev.tipo) }} />
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
                        <td className={styles["tabla__tenue"]}>{ev.area || "—"}</td>
                        <td className={styles["tabla__tenue"]}>
                          {ev.lugar || "—"}
                          <small className={styles["tabla__sub"]}>
                            {ev.plantel || "Todos los planteles"}{ev.turno ? ` · ${ev.turno}` : ""}
                          </small>
                        </td>
                        <td>
                          <span className="etiqueta" style={{ backgroundColor: colorTipo(ev.tipo) + '20', color: colorTipo(ev.tipo) }}>
                            {etiquetaTipo(ev.tipo)}
                          </span>
                        </td>
                        {!lectura && (
                          <td>
                            {ev.puede_editar && (
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
                            )}
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
          <button
            type="button"
            className={styles["panel-asa"]}
            onClick={() => setPanelAbierto(false)}
            aria-label="Cerrar panel"
          >
            <span className={styles["panel-asa__bar"]} />
          </button>

          {/* Encabezado del panel con X para cerrarlo */}
          <div className={styles["panel-cab"]}>
            <span className={styles["panel-cab__titulo"]}>Simbología</span>
            <button
              type="button"
              className={styles["panel-cab__cerrar"]}
              onClick={() => setPanelAbierto(false)}
              aria-label="Cerrar panel"
            >
              <X size={18} />
            </button>
          </div>

          {/* Simbología: catálogo de tipos de evento */}
          <article className="tarjeta">
            <div className="tarjeta__cabecera">
              <div className="tarjeta__titulo">
                <Tag size={16} />
                Simbología
              </div>
              {puedeGestionarTipos && !formTipoVisible && (
                <button
                  type="button"
                  className="tarjeta__enlace"
                  onClick={() => { setFormTipoVisible(true); setTipoEditandoId(null); }}
                >
                  + Nuevo
                </button>
              )}
            </div>
            <ul className={styles["simbologia"]}>
              {tiposSimbologia.map((t) => (
                <li key={t.id} className={styles["simbologia__item"]}>
                  {tipoEditandoId === t.id ? (
                    <div className={styles["simbologia__edit"]}>
                      <input
                        type="color"
                        className={styles["simbologia__color-input"]}
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        title="Elegir color"
                      />
                      <input
                        type="text"
                        className={styles["simbologia__nombre-input"]}
                        value={editNombre}
                        onChange={(e) => setEditNombre(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') guardarEdicionTipo(t.id); if (e.key === 'Escape') setTipoEditandoId(null); }}
                        autoFocus
                      />
                      <div className={styles["simbologia__edit-acciones"]}>
                        <button type="button" title="Guardar" onClick={() => guardarEdicionTipo(t.id)}>
                          <Check size={13} />
                        </button>
                        <button type="button" title="Cancelar" onClick={() => setTipoEditandoId(null)}>
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className={styles["simbologia__punto"]} style={{ backgroundColor: t.color }} />
                      <span className={styles["simbologia__texto"]}>{t.etiqueta}</span>
                      {puedeGestionarTipos && (esSuperusuario || !t.es_global) && (
                        <div className={styles["simbologia__acciones"]}>
                          <button type="button" title="Editar" onClick={() => iniciarEdicionTipo(t)}>
                            <Pencil size={12} />
                          </button>
                          <button type="button" title="Eliminar" className={styles["simbologia__borrar"]} onClick={() => pedirEliminarTipo(t)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>

            {/* Formulario para añadir nuevo tipo */}
            {formTipoVisible && (
              <div className={styles["simbologia__nuevo"]}>
                <div className={styles["simbologia__nuevo-fila"]}>
                  <input
                    type="color"
                    className={styles["simbologia__color-input"]}
                    value={nuevoColor}
                    onChange={(e) => setNuevoColor(e.target.value)}
                    title="Elegir color"
                  />
                  <input
                    type="text"
                    className={styles["simbologia__nombre-input"]}
                    placeholder="Nombre del tipo..."
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') guardarNuevoTipo(); if (e.key === 'Escape') setFormTipoVisible(false); }}
                    autoFocus
                  />
                </div>
                {esAdmin && (sesion.planteles?.length ?? 0) > 1 && (
                  <select
                    className={styles["simbologia__plantel-select"]}
                    value={nuevoPlantelId}
                    onChange={(e) => setNuevoPlantelId(e.target.value)}
                  >
                    <option value="">Plantel...</option>
                    {sesion.planteles?.map((a) => (
                      <option key={a.plantel.id} value={a.plantel.id}>{a.plantel.nombre}</option>
                    ))}
                  </select>
                )}
                <div className={styles["simbologia__nuevo-acciones"]}>
                  <button type="button" onClick={guardarNuevoTipo} disabled={!nuevoNombre.trim()}>
                    Guardar
                  </button>
                  <button type="button" onClick={() => setFormTipoVisible(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
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
            <span className={styles["pop-evento__punto"]} style={{ backgroundColor: colorTipo(popover.ev.tipo) }} />
            <span className={styles["pop-evento__titulo"]}>{popover.ev.titulo}</span>
            <div className={styles["pop-evento__acciones"]}>
              {!lectura && popover.ev.puede_editar && (
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
              <span className="etiqueta" style={{ backgroundColor: colorTipo(popover.ev.tipo) + '20', color: colorTipo(popover.ev.tipo) }}>
                {etiquetaTipo(popover.ev.tipo)}
              </span>
            </li>
          </ul>
        </div>
      )}

      {/* Modal: detalle del evento (vista móvil) */}
      <Modal
        abierto={!!detalleEvento}
        titulo="Detalle del evento"
        onCerrar={() => setDetalleEvento(null)}
        pie={
          detalleEvento && !lectura && detalleEvento.puede_editar ? (
            <>
              <button
                type="button"
                className="boton boton--fantasma"
                style={{ marginRight: "auto" }}
                onClick={() => { const ev = detalleEvento; setDetalleEvento(null); pedirEliminar(ev); }}
              >
                Eliminar
              </button>
              <button
                type="button"
                className="boton boton--primario"
                onClick={() => { const ev = detalleEvento; setDetalleEvento(null); abrirEditarEvento(ev); }}
              >
                Editar
              </button>
            </>
          ) : null
        }
      >
        {detalleEvento && (
          <div className={styles["detalle"]}>
            <div className={styles["detalle__cab"]}>
              <span className={styles["detalle__punto"]} style={{ backgroundColor: colorTipo(detalleEvento.tipo) }} />
              <h4 className={styles["detalle__titulo"]}>{detalleEvento.titulo}</h4>
            </div>
            <ul className={styles["pop-evento__datos"]}>
              <li>
                <CalendarDays size={14} />
                {formatoFechaLarga(detalleEvento.fecha)}
                {detalleEvento.fechaFin && detalleEvento.fechaFin !== detalleEvento.fecha
                  ? ` – ${formatoFechaLarga(detalleEvento.fechaFin)}`
                  : ""}
              </li>
              <li>
                <Clock size={14} />
                {detalleEvento.horaInicio
                  ? `${formatoHora(detalleEvento.horaInicio)}${detalleEvento.horaFin ? ` – ${formatoHora(detalleEvento.horaFin)}` : ""}`
                  : "Todo el día"}
              </li>
              {duracionTexto(detalleEvento) && (
                <li>
                  <Hourglass size={14} />
                  {duracionTexto(detalleEvento)}
                </li>
              )}
              {detalleEvento.lugar && (
                <li>
                  <MapPin size={14} />
                  {detalleEvento.lugar}
                </li>
              )}
              <li>
                <Tag size={14} />
                <span className="etiqueta" style={{ backgroundColor: colorTipo(detalleEvento.tipo) + '20', color: colorTipo(detalleEvento.tipo) }}>
                  {etiquetaTipo(detalleEvento.tipo)}
                </span>
              </li>
              {[detalleEvento.area, detalleEvento.plantel, detalleEvento.turno,
                (detalleEvento.semestre != null || detalleEvento.grupo != null) ? alcanceEvento(detalleEvento) : null,
              ].filter(Boolean).length > 0 && (
                <li>
                  <Filter size={14} />
                  {[detalleEvento.area, detalleEvento.plantel, detalleEvento.turno,
                    (detalleEvento.semestre != null || detalleEvento.grupo != null) ? alcanceEvento(detalleEvento) : null,
                  ].filter(Boolean).join(" · ")}
                </li>
              )}
            </ul>
          </div>
        )}
      </Modal>

      {/* Modal: filtros rápidos */}
      <Modal
        abierto={filtrosModalAbierto}
        titulo="Filtros rápidos"
        onCerrar={() => setFiltrosModalAbierto(false)}
        pie={
          <>
            {hayFiltros && (
              <button type="button" className="boton boton--fantasma" style={{ marginRight: "auto" }} onClick={limpiarFiltros}>
                Limpiar filtros
              </button>
            )}
            <button type="button" className="boton boton--primario" onClick={() => setFiltrosModalAbierto(false)}>
              Aplicar
            </button>
          </>
        }
      >
        <div className={styles["filtros"]}>
          <label className="formulario__campo">
            <span className="formulario__etiqueta">Tipo de evento</span>
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="todos">Todos</option>
              {tiposSimbologia.map((t) => (
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

          {!esSuperusuario && (
            <label className="formulario__campo">
              <span className="formulario__etiqueta">Plantel</span>
              {plantelesPermitidos.length > 0 ? (
                plantelesPermitidos.length === 1 ? (
                  <select value={plantelesPermitidos[0]} disabled>
                    <option value={plantelesPermitidos[0]}>{plantelesPermitidos[0]}</option>
                  </select>
                ) : (
                  <select value={filtroPlantel} onChange={(e) => setFiltroPlantel(e.target.value)}>
                    <option value="">Todos mis planteles</option>
                    {plantelesPermitidos.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                )
              ) : (
                <SelectorPlantel
                  value={filtroPlantel}
                  onChange={setFiltroPlantel}
                  textoTodos="Todos"
                />
              )}
            </label>
          )}

          <label className="formulario__campo">
            <span className="formulario__etiqueta">Turno</span>
            {turnosPermitidos.length > 0 ? (
              turnosPermitidos.length === 1 ? (
                <select value={turnosPermitidos[0]} disabled>
                  <option value={turnosPermitidos[0]}>{turnosPermitidos[0]}</option>
                </select>
              ) : (
                <select value={filtroTurno} onChange={(e) => setFiltroTurno(e.target.value)}>
                  <option value="">Todos mis turnos</option>
                  {turnosPermitidos.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )
            ) : (
              <select value={filtroTurno} onChange={(e) => setFiltroTurno(e.target.value)}>
                <option value="">Todos</option>
                {TURNOS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
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
      </Modal>

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
          tipos={tiposParaCrear}
          restringido={esAdmin}
          planteles={misPlanteles}
          turnos={misTurnos}
          onChange={(campo, valor) => setFormEvento((prev) => ({ ...prev, [campo]: valor }))}
          onSubmit={guardarEvento}
        />
        {(esAdmin || esSuperusuario) && calVinculado?.vinculado && !eventoEditando && (
          <label className={styles["google-cal-opcion"]}>
            <input
              type="checkbox"
              checked={formEvento.agregarAGoogleCalendar}
              onChange={(e) => setFormEvento((prev) => ({ ...prev, agregarAGoogleCalendar: e.target.checked }))}
            />
            <span>Agregar a mi Google Calendar</span>
          </label>
        )}
      </Modal>
    </div>
  );
}
