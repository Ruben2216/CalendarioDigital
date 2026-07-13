import { useCallback, useMemo, useRef, useState, useEffect, lazy, Suspense } from "react";

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
  PanelRight, X, Clock, MapPin, Building2, Hourglass, Check, Eye, Download,
} from "lucide-react";
import Modal from "../../../components/modal/Modal.jsx";
import FormularioEvento from "../../../components/formulario-evento/FormularioEvento.jsx";
import {
  NOMBRES_MES, ABREV_MES, aClaveFecha, sumarDias, minutosDe, formatoHora,
  formatoFechaLarga, calcularSemestre, ahoraMexico, rangoSemana,
} from "../../../lib/fechas.js";
import { AREAS, SEMESTRES, GRUPOS, TURNOS, alcanceEvento } from "../../../data/calendario.js";
import { useTipoEventoCrud } from "./hooks/useTipoEventoCrud.js";
import { useDatosCalendario } from "./hooks/useDatosCalendario.js";
import { useEventoCrud } from "./hooks/useEventoCrud.js";
import SelectorPlantel from "../../../components/selector-plantel/SelectorPlantel.jsx";
import SelectorFecha from "../../../components/campos/SelectorFecha.jsx";
import { useSesion } from "../../../hooks/useSesion.js";
import { usePreferencia } from "../../../hooks/usePreferencia.js";
import VistaAnual from "./vistas/VistaAnual.jsx";
import VistaLista from "./vistas/VistaLista.jsx";
import VistaMesMovil from "./vistas/VistaMesMovil.jsx";
import { useGoogleCalendarSync } from "../../../hooks/useGoogleCalendarSync.js";
import { esGestorGlobal, plantelesPermitidos as calcularPlantelesPermitidos, turnosPermitidos as calcularTurnosPermitidos } from "../../../lib/permisos.js";
import {
  mapaTipos, colorDeTipo, etiquetaDeTipo, filtrarEventos,
  eventosParaFullCalendar, agruparEventosPorDia,
} from "../../../lib/calendarioTransformaciones.js";
import VistaSemanaMovil from "./vistas/VistaSemanaMovil.jsx";
import styles from "./calendario.module.css";
import "./fullcalendar.css";

// El generador de PDF (@react-pdf/renderer) es pesado: se carga bajo demanda.
const ModalExportarPdf = lazy(() => import("./pdf/ModalExportarPdf.jsx"));

const VISTAS = [
  { id: "mes", etiqueta: "Mes", icono: CalendarDays, fc: "dayGridMonth" },
  { id: "semana", etiqueta: "Semana", icono: CalendarRange, fc: "timeGridWeek" },
  { id: "anual", etiqueta: "Anual", icono: LayoutGrid, fc: "multiMonthYear" },
  { id: "lista", etiqueta: "Lista", icono: List, fc: "listMonth" },
];

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
  const esGestor = esGestorGlobal(sesion);
  const esAdmin = sesion.rol === "admin";
  const esInvitado = publico || sesion.rol === "tutor";

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
  // el alumno tiene 1 fijo; el docente y el admin, los que tengan asignados
  // (el backend ya restringe sus eventos a esos planteles); el superusuario
  // ve todo (su filtro de plantel es el buscador general).
  const plantelesPermitidos = useMemo(() => calcularPlantelesPermitidos(sesion), []);
  const turnosPermitidos = useMemo(() => calcularTurnosPermitidos(sesion), []);

  const [vista, setVista] = usePreferencia("calendario:vista", "mes"); // vista activa (recordada)
  const [fechaActual, setFechaActual] = useState(hoy);                // mes/fecha que muestra FC
  const [tituloVista, setTituloVista] = useState("");                 // título que da FC (semana/anual/lista)
  const [fechaSeleccionada, setFechaSeleccionada] = useState(claveHoy); // día resaltado (inicio del rango)
  const [rangoFin, setRangoFin] = useState(null);                       // fin del rango (Mayús+clic)
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

  // Datos del calendario (catálogo, tipos y eventos desde la BD)
  const {
    tipos, setTipos, eventos, calendarios,
    calendarioActivo, setCalendarioActivo, cargarEventos,
  } = useDatosCalendario({ publico, vistaPlantel });

  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [pickerAbierto, setPickerAbierto] = useState(false);            // selector de mes
  const [anioPicker, setAnioPicker] = useState(() => hoy.getFullYear());
  const [vistaMenu, setVistaMenu] = useState(false);                    // menú desplegable de vista
  
  const [panelAbierto, setPanelAbierto] = usePreferencia("calendario:panel", false);
  const [gruposColapsados, setGruposColapsados] = usePreferencia("calendario:simbologiaColapsados", []);
  const alternarGrupoSimbologia = (clave) =>
    setGruposColapsados((prev) =>
      prev.includes(clave) ? prev.filter((k) => k !== clave) : [...prev, clave]
    );
  const [filtrosModalAbierto, setFiltrosModalAbierto] = useState(false);
  const [esMobil, setEsMobil] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches
  );
  const [esMonitor, setEsMonitor] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1920px)").matches
  );
  const [altoVentana, setAltoVentana] = useState(
    () => (typeof window !== "undefined" ? window.innerHeight : 800)
  );

  // Info rápida
  const [popover, setPopover] = useState(null);
  const [eventoSelId, setEventoSelId] = useState(null);
  const [detalleEvento, setDetalleEvento] = useState(null);  // modal de detalles (móvil)

  // Exportar el calendario a PDF (no disponible para alumno ni acceso público)
  const [modalExportar, setModalExportar] = useState(false);
  const puedeExportar = !publico && !esAlumno;
  const anioCicloActual = fechaActual.getMonth() >= 7
    ? fechaActual.getFullYear()
    : fechaActual.getFullYear() - 1;

  // Gestión de tipos de evento (simbología)
  const {
    tipoEditandoId, setTipoEditandoId,
    editNombre, setEditNombre,
    editColor, setEditColor,
    formTipoVisible, setFormTipoVisible,
    nuevoNombre, setNuevoNombre,
    nuevoColor, setNuevoColor,
    nuevoPlantelId, setNuevoPlantelId,
    guardandoTipo,
    iniciarEdicionTipo, guardarEdicionTipo, pedirEliminarTipo, guardarNuevoTipo,
  } = useTipoEventoCrud({
    setTipos,
    esAdmin,
    plantelPorDefectoId: sesion.planteles?.[0]?.plantel?.id,
  });

  const {
    calVinculado,
    abrirVinculacion: abrirVinculacionGoogle,
    desconectar: desconectarCalendar,
  } = useGoogleCalendarSync({ activo: !publico, idUsuario: sesion?.id_usuario });

  // Referencias: a FullCalendar (para controlarlo) y a los desplegables.
  const calendarRef = useRef(null);
  const lienzoRef = useRef(null);
  const pickerRef = useRef(null);
  const vistaRef = useRef(null);
  const popoverRef = useRef(null);
  const asideRef = useRef(null);
  const clicTimer = useRef(null);
  const cierreHoverTimer = useRef(null);
  const arrastreRef = useRef(false);

  useEffect(() => {
    const terminarArrastre = () => { arrastreRef.current = false; };
    window.addEventListener("mouseup", terminarArrastre);
    return () => window.removeEventListener("mouseup", terminarArrastre);
  }, []);

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
    const mqMonitor = window.matchMedia("(min-width: 1920px)");
    const onMonitor = (e) => setEsMonitor(e.matches);
    const onResize = () => setAltoVentana(window.innerHeight);
    mqMonitor.addEventListener("change", onMonitor);
    window.addEventListener("resize", onResize);
    return () => {
      mqMonitor.removeEventListener("change", onMonitor);
      window.removeEventListener("resize", onResize);
    };
  }, []);

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
  const tiposPorId = useMemo(() => mapaTipos(tipos), [tipos]);

  const colorTipo = useCallback((id) => colorDeTipo(tiposPorId, id), [tiposPorId]);
  const etiquetaTipo = useCallback((id) => etiquetaDeTipo(tiposPorId, id), [tiposPorId]);

  // Semestre (A/B) según el mes que se está viendo (insignia del encabezado).
  const semestre = calcularSemestre(fechaActual);

  // El admin solo crea en el escolarizado, el superusuario en cualquiera, el resto no crea
  const calActivo = useMemo(
    () => calendarios.find((c) => c.id === calendarioActivo) || null,
    [calendarios, calendarioActivo]
  );
  /* El admin crea solo con sus tipos de plantel; el superusuario solo con los
     generales (los de plantel son responsabilidad del admin de cada plantel). */
  const tiposParaCrear = useMemo(() => {
    if (esAdmin) return tipos.filter((t) => !t.es_global);
    if (esGestor) return tipos.filter((t) => t.es_global);
    return tipos;
  }, [tipos, esAdmin, esGestor]);

  const tiposSimbologia = useMemo(() => {
    if (!esGestor) return tipos;
    if (!vistaPlantel) return tipos.filter((t) => t.es_global);
    return tipos.filter((t) => t.es_global || t.plantel === vistaPlantel);
  }, [tipos, esGestor, vistaPlantel]);
  const tienesTipos = tiposParaCrear.length > 0;
  const puedeCrear = !lectura && tienesTipos && (esGestor || (esAdmin && calActivo?.clave === "escolarizado"));

  // Eventos visibles tras aplicar los filtros de tipo y área.
  const eventosFiltrados = useMemo(() => filtrarEventos(eventos, {
    filtroTipo, filtroArea, filtroSemestre, filtroGrupo,
    filtroPlantel, filtroTurno, filtroFechaDesde, filtroFechaHasta,
  }), [
    eventos, filtroTipo, filtroArea, filtroSemestre, filtroGrupo,
    filtroPlantel, filtroTurno, filtroFechaDesde, filtroFechaHasta,
  ]);

  const eventosFC = useMemo(
    () => eventosParaFullCalendar(eventosFiltrados, colorTipo),
    [eventosFiltrados, colorTipo]
  );

  /* Mapa "YYYY-MM-DD" -> eventos de ese día (para el panel inferior). Incluye
     cada día que abarca un evento de varios días */
  const eventosPorDia = useMemo(() => agruparEventosPorDia(eventosFiltrados), [eventosFiltrados]);

  // Rango de días seleccionado: inicio = primer día, fin = último (Mayús+clic).
  const rangoSeleccionado = useMemo(() => {
    if (!fechaSeleccionada) return null;
    if (!rangoFin || rangoFin === fechaSeleccionada) {
      return { inicio: fechaSeleccionada, fin: fechaSeleccionada };
    }
    return fechaSeleccionada <= rangoFin
      ? { inicio: fechaSeleccionada, fin: rangoFin }
      : { inicio: rangoFin, fin: fechaSeleccionada };
  }, [fechaSeleccionada, rangoFin]);

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

  const seleccionarDia = (clave) => {
    setFechaSeleccionada(clave);
    setRangoFin(null);
    setMesSeleccionado(null);
  };

  // Arrastre con clic izquierdo: el primer día es el inicio y hasta donde se suelte, el fin.
  const iniciarArrastre = (clave) => {
    setFechaSeleccionada(clave);
    setRangoFin(clave);
    setMesSeleccionado(null);
    arrastreRef.current = true;
  };

  const extenderArrastre = (clave) => {
    if (arrastreRef.current) setRangoFin(clave);
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
    setRangoFin(null);
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
    setRangoFin(null);
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

  // Doble click = crear nuevo evento (unicamente vista mensual)
  const ultimoClickFecha = useRef({ fecha: null, t: 0 });
  const alClicarFecha = (arg) => {
    const fecha = arg.dateStr.slice(0, 10);
    setFechaSeleccionada(fecha);
    setRangoFin(null);

    const ahora = Date.now();
    const previo = ultimoClickFecha.current;
    if (puedeCrear && previo.fecha === fecha && ahora - previo.t < 400) {
      ultimoClickFecha.current = { fecha: null, t: 0 };
      abrirNuevoEventoEnFecha(fecha);
      return;
    }
    ultimoClickFecha.current = { fecha, t: ahora };
  };

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
    (arg) => {
      const clave = aClaveFecha(arg.date);
      return rangoSeleccionado && clave >= rangoSeleccionado.inicio && clave <= rangoSeleccionado.fin
        ? "cal-fc-sel"
        : "";
    },
    [rangoSeleccionado]
  );

  const claseEventoSeleccionado = useCallback(
    (arg) => (arg.event.id === eventoSelId ? "cal-fc-ev-sel" : ""),
    [eventoSelId]
  );

  const alMontarCeldaDia = useCallback(
    (arg) => {
      if (puedeCrear && arg.view.type === "dayGridMonth") {
        arg.el.title = "Clic derecho: nuevo evento · Arrastra para seleccionar un rango";
      }
    },
    [puedeCrear]
  );

  // CRUD
  const {
    modalEvento, setModalEvento,
    formEvento, setFormEvento,
    eventoEditando, guardandoEvento,
    errorEvento, setErrorEvento,
    abrirNuevoEventoEnFecha, abrirEditarEvento,
    guardarEvento, pedirEliminar, eliminarDesdeEdicion,
  } = useEventoCrud({
    calendarioActivo,
    claveHoy,
    eventos,
    cargarEventos,
    valoresIniciales: () => ({
      tipo: tiposParaCrear[0]?.id || "",
      plantel: esAdmin ? (misAsignaciones[0]?.plantel || "") : "",
      turno: esAdmin ? (misAsignaciones[0]?.turno || "") : "",
      agregarAGoogleCalendar: Boolean(calVinculado?.vinculado),
    }),
    alGuardar: (fecha) => {
      setFechaSeleccionada(fecha);
      api()?.gotoDate(fecha);
    },
    antesDeEliminar: cerrarPopover,
  });

  /* Al editar, el tipo actual del evento se conserva aunque no esté entre los
     tipos permitidos para crear (p. ej. superusuario editando un evento de plantel). */
  const tiposFormulario = useMemo(() => {
    if (!eventoEditando) return tiposParaCrear;
    if (tiposParaCrear.some((t) => String(t.id) === String(formEvento.tipo))) return tiposParaCrear;
    const actual = tipos.find((t) => String(t.id) === String(formEvento.tipo));
    return actual ? [...tiposParaCrear, actual] : tiposParaCrear;
  }, [tiposParaCrear, tipos, eventoEditando, formEvento.tipo]);

  const abrirNuevoEvento = () => abrirNuevoEventoEnFecha(fechaSeleccionada || claveHoy);

  /* Clic derecho sobre una fecha (vista mes o año): abre "Nuevo evento" con ese día
     como fecha de inicio. Solo actúa si el usuario puede crear eventos. */
  const abrirMenuNuevoEvento = (e, fecha) => {
    if (!puedeCrear || !fecha) return;
    e.preventDefault();
    const rango = rangoSeleccionado;
    const enRango =
      rango && rango.inicio !== rango.fin && fecha >= rango.inicio && fecha <= rango.fin;
    if (enRango) {
      abrirNuevoEventoEnFecha(rango.inicio, rango.fin);
      return;
    }
    setFechaSeleccionada(fecha);
    setRangoFin(null);
    abrirNuevoEventoEnFecha(fecha);
  };

  const alMenuContextualMes = (e) => {
    if (vista !== "mes") return;
    const celda = e.target.closest(".fc-daygrid-day");
    if (!celda) return;
    abrirMenuNuevoEvento(e, celda.getAttribute("data-date"));
  };

  const claveDeCeldaMes = (destino) =>
    destino?.closest?.(".fc-daygrid-day")?.getAttribute("data-date") || null;

  const alPresionarMes = (e) => {
    if (vista !== "mes" || e.button !== 0 || e.target.closest(".fc-event")) return;
    const clave = claveDeCeldaMes(e.target);
    if (!clave) return;
    e.preventDefault();
    iniciarArrastre(clave);
  };

  const alArrastrarMes = (e) => {
    if (!arrastreRef.current || vista !== "mes") return;
    const clave = claveDeCeldaMes(e.target);
    if (clave) extenderArrastre(clave);
  };

  // CRUD de tipos de evento
  const puedeGestionarTipos = !lectura && (esGestor || esAdmin);

  const simbologiaAgrupada = useMemo(() => {
    const generales = [];
    const porPlantel = new Map();
    for (const t of tiposSimbologia) {
      if (t.es_global) {
        generales.push(t);
      } else {
        const nombre = t.plantel || "Sin plantel";
        if (!porPlantel.has(nombre)) porPlantel.set(nombre, []);
        porPlantel.get(nombre).push(t);
      }
    }
    const grupos = [];
    if (generales.length) grupos.push({ clave: "__generales", titulo: "Generales", tipos: generales });
    for (const [nombre, lista] of porPlantel) {
      grupos.push({ clave: nombre, titulo: nombre, tipos: lista });
    }
    return grupos;
  }, [tiposSimbologia]);

  const filaTipo = (t) => (
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
          {puedeGestionarTipos && t.puede_editar && (
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
  );

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
        {esGestor && (
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
              {!esInvitado && (
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
              )}

              {/* Descargar el calendario en PDF */}
              {puedeExportar && (
                <button
                  type="button"
                  className={`boton boton--fantasma ${styles["barra__panel-btn"]}`}
                  onClick={() => setModalExportar(true)}
                  aria-label="Descargar PDF"
                  title="Descargar el calendario en PDF"
                >
                  <Download size={16} />
                  Descargar
                </button>
              )}

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

        <div className={styles["calendario__fila"]}>
          <div className={styles["calendario__principal"]}>
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
              <div
                className="cal-fc"
                onContextMenu={alMenuContextualMes}
                onMouseDown={alPresionarMes}
                onMouseOver={alArrastrarMes}
              >
                <FullCalendar
                  ref={calendarRef}
                  plugins={[dayGridPlugin, timeGridPlugin, multiMonthPlugin, listPlugin, interactionPlugin]}
                  initialView={vista === "semana" ? "timeGridWeek" : "dayGridMonth"}
                  initialDate={aClaveFecha(fechaActual)}
                  headerToolbar={false}
                  locale={esLocale}
                  firstDay={0}
                  height={vista === "semana" ? 640 : (esMonitor ? Math.max(700, altoVentana - 220) : 720)}
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
                  dayCellDidMount={alMontarCeldaDia}
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
              rangoSeleccionado={rangoSeleccionado}
              mesSeleccionado={mesSeleccionado}
              onSeleccionarDia={seleccionarDia}
              onArrastreInicio={iniciarArrastre}
              onArrastreExtender={extenderArrastre}
              onSeleccionarMes={setMesSeleccionado}
              onNuevoEvento={puedeCrear ? abrirMenuNuevoEvento : undefined}
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

          {/* Simbología: catálogo de tipos de evento */}
          <article className="tarjeta">
            <div className="tarjeta__cabecera">
              <div className="tarjeta__titulo">
                <Tag size={16} />
                Simbología
              </div>
              <div className={styles["simbologia__cab-acciones"]}>
                {puedeGestionarTipos && !formTipoVisible && (
                  <button
                    type="button"
                    className="tarjeta__enlace"
                    onClick={() => { setFormTipoVisible(true); setTipoEditandoId(null); }}
                  >
                    + Nuevo
                  </button>
                )}
                <button
                  type="button"
                  className={styles["panel-cab__cerrar"]}
                  onClick={() => setPanelAbierto(false)}
                  aria-label="Cerrar simbología"
                  title="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className={styles["simbologia"]}>
              {simbologiaAgrupada.length === 0 && (
                <p className={styles["simbologia__vacio"]}>No hay tipos de evento.</p>
              )}
              {simbologiaAgrupada.map((g) => {
                const colapsado = gruposColapsados.includes(g.clave);
                return (
                  <div key={g.clave} className={styles["simbologia__grupo"]}>
                    <button
                      type="button"
                      className={styles["simbologia__grupo-titulo"]}
                      onClick={() => alternarGrupoSimbologia(g.clave)}
                      aria-expanded={!colapsado}
                    >
                      <ChevronDown
                        size={14}
                        className={`${styles["simbologia__grupo-chevron"]} ${colapsado ? styles["simbologia__grupo-chevron--cerrado"] : ""}`}
                      />
                      <span className={styles["simbologia__grupo-nombre"]}>{g.titulo}</span>
                      <span className={styles["simbologia__grupo-conteo"]}>{g.tipos.length}</span>
                    </button>
                    {!colapsado && (
                      <ul className={styles["simbologia__lista"]}>
                        {g.tipos.map(filaTipo)}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

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
                  <button type="button" onClick={guardarNuevoTipo} disabled={!nuevoNombre.trim() || guardandoTipo}>
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
      </div>

      {/* Diálogo para descargar el calendario en PDF */}
      {modalExportar && (
        <Suspense fallback={null}>
          <ModalExportarPdf
            eventosFiltrados={eventosFiltrados}
            eventosTodos={eventos}
            tipos={tipos}
            defaultAnioCiclo={anioCicloActual}
            defaultAnio={fechaActual.getFullYear()}
            defaultMes={fechaActual.getMonth()}
            calendarioNombre={calActivo?.nombre}
            plantelesAsignados={plantelesPermitidos}
            permitirFiltros={!esInvitado}
            onCerrar={() => setModalExportar(false)}
          />
        </Suspense>
      )}

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
              <Building2 size={14} />
              {popover.ev.plantel || "Todos los planteles"}{popover.ev.turno ? ` · ${popover.ev.turno}` : ""}
            </li>
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
              {simbologiaAgrupada.map((g) => (
                <optgroup key={g.clave} label={g.titulo}>
                  {g.tipos.map((t) => (
                    <option key={t.id} value={t.id}>{t.etiqueta}</option>
                  ))}
                </optgroup>
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

          {!esInvitado && (
            <label className="formulario__campo">
              <span className="formulario__etiqueta">Semestre</span>
              <select value={filtroSemestre} disabled={esAlumno} onChange={(e) => setFiltroSemestre(e.target.value)}>
                <option value="">Todos</option>
                {SEMESTRES.map((s) => (
                  <option key={s} value={s}>{s}.º</option>
                ))}
              </select>
            </label>
          )}

          {!esInvitado && (
            <label className="formulario__campo">
              <span className="formulario__etiqueta">Grupo</span>
              <select value={filtroGrupo} disabled={esAlumno} onChange={(e) => setFiltroGrupo(e.target.value)}>
                <option value="">Todos</option>
                {GRUPOS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </label>
          )}

          {!esInvitado && !esGestor && (
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

          {!esInvitado && (
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
          )}

          {!esInvitado && (
            <div className="formulario__fila">
              <div className="formulario__campo">
                <span className="formulario__etiqueta">Desde</span>
                <SelectorFecha
                  value={filtroFechaDesde}
                  placeholder="Cualquiera"
                  onChange={setFiltroFechaDesde}
                />
              </div>
              <div className="formulario__campo">
                <span className="formulario__etiqueta">Hasta</span>
                <SelectorFecha
                  value={filtroFechaHasta}
                  min={filtroFechaDesde}
                  placeholder="Cualquiera"
                  onChange={setFiltroFechaHasta}
                />
              </div>
            </div>
          )}
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
            <button type="submit" form="form-evento-calendario" className="boton boton--primario" disabled={guardandoEvento}>
              {guardandoEvento
                ? "Guardando…"
                : eventoEditando ? "Guardar cambios" : "Crear evento"}
            </button>
          </>
        }
      >
        <FormularioEvento
          id="form-evento-calendario"
          form={formEvento}
          tipos={tiposFormulario}
          restringido={esAdmin}
          puedePublico={esGestor}
          planteles={misPlanteles}
          turnos={misTurnos}
          error={errorEvento}
          minFecha={claveHoy}
          onChange={(campo, valor) => {
            if (errorEvento) setErrorEvento(null);
            setFormEvento((prev) => ({ ...prev, [campo]: valor }));
          }}
          onSubmit={guardarEvento}
        />
        {(esAdmin || esGestor) && calVinculado?.vinculado && !eventoEditando && (
          <div className={styles["interruptor"]}>
            <div>
              <span className="formulario__etiqueta">Agregar a mi Google Calendar</span>
              <p className={styles["interruptor__nota"]}>
                Si se activa, este evento también se creará en tu Google Calendar.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={formEvento.agregarAGoogleCalendar}
              className={`${styles["switch"]} ${formEvento.agregarAGoogleCalendar ? styles["switch--on"] : ""}`}
              onClick={() => setFormEvento((prev) => ({ ...prev, agregarAGoogleCalendar: !prev.agregarAGoogleCalendar }))}
            >
              <span className={styles["switch__bolita"]} />
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
