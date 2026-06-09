import { useMemo, useRef, useState, useEffect } from "react";
import {
  CalendarDays, CalendarRange, LayoutGrid, List, ChevronLeft, ChevronRight,
  ChevronDown, Plus, Download, Pencil, Copy, Trash2, Settings2, Filter, Tag,
} from "lucide-react";
import Modal from "../../../components/modal/Modal.jsx";
import styles from "./calendario.module.css";

const ZONA = "America/Mexico_City";

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const COLORES_TIPO = [
  { valor: "azul", etiqueta: "Azul" },
  { valor: "naranja", etiqueta: "Naranja" },
  { valor: "morado", etiqueta: "Morado" },
  { valor: "verde", etiqueta: "Verde" },
  { valor: "teal", etiqueta: "Verde azulado" },
  { valor: "marino", etiqueta: "Azul marino" },
  { valor: "rojo", etiqueta: "Rojo" },
];

const TIPOS_INICIALES = [
  { id: "academico", etiqueta: "Académico", color: "azul" },
  { id: "administrativo", etiqueta: "Administrativo", color: "naranja" },
  { id: "cultural", etiqueta: "Cultural", color: "morado" },
  { id: "deportivo", etiqueta: "Deportivo", color: "verde" },
  { id: "institucional", etiqueta: "Institucional", color: "marino" },
  { id: "formacion", etiqueta: "Formación", color: "teal" },
  { id: "urgente", etiqueta: "Urgente", color: "rojo" },
];

const AREAS = [
  "Académica", "Administrativa", "Deportiva",
  "Cultural", "Formación", "Institucional",
];

// Simbología del calendario oficial
const SIMBOLOGIA = [
  { etiqueta: "Inicio de curso", color: "verde", forma: "punto" },
  { etiqueta: "Fin de curso", color: "negro", forma: "punto" },
  { etiqueta: "Día inhábil", color: "rojo", forma: "punto" },
  { etiqueta: "Receso intersemestral", color: "marron", forma: "rango" },
  { etiqueta: "Vacaciones", color: "naranja", forma: "rango" },
  { etiqueta: "Semana de planeación del ciclo escolar", color: "verde", forma: "rango" },
  { etiqueta: "Cierre de primera evaluación sumativa", color: "rosa", forma: "anillo" },
  { etiqueta: "Cierre de segunda evaluación sumativa", color: "azul", forma: "anillo" },
  { etiqueta: "Primera evaluación de recuperación", color: "celeste", forma: "punto" },
  { etiqueta: "Entrega de calificaciones", color: "amarillo", forma: "punto" },
  { etiqueta: "Curso propedéutico alumnos 1.er semestre", color: "morado", forma: "punto" },
  { etiqueta: "Segunda evaluación de recuperación", color: "naranja", forma: "punto" },
  { etiqueta: "Reunión de trabajo colegiado", color: "marron", forma: "punto" },
];

// Utilidades de fecha
function ahoraMexico() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: ZONA }));
}

function aClaveFecha(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function desdeClaveFecha(clave) {
  const [anio, mes, dia] = clave.split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

function formatoHora(hora) {
  if (!hora) return "";
  const [h, m] = hora.split(":").map(Number);
  const periodo = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${periodo}`;
}

// Un evento se dibuja como barra con nombre si es un periodo
// o si abarca dos o más días; en otro caso, como punto.
function esBarra(ev) {
  return ev.formato === "rango" || (ev.fechaFin && ev.fechaFin !== ev.fecha);
}

function formatoFechaLarga(clave) {
  const texto = new Intl.DateTimeFormat("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(desdeClaveFecha(clave));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Semestre A: agosto–enero - Semestre B: febrero–julio
function calcularSemestre(fecha) {
  const mes = fecha.getMonth();
  const anio = fecha.getFullYear();
  if (mes >= 7) return { letra: "A", ciclo: anio };
  if (mes === 0) return { letra: "A", ciclo: anio - 1 };
  return { letra: "B", ciclo: anio };
}

function eventosIniciales() {
  return [
    { id: 1, titulo: "Curso propedéutico alumnos 1.er semestre", tipo: "cultural", area: "Cultural", fecha: "2026-06-02", fechaFin: "2026-06-04", horaInicio: "", horaFin: "", lugar: "Auditorio", formato: "rango" },
    { id: 2, titulo: "Examen parcial de Matemáticas", tipo: "academico", area: "Académica", fecha: "2026-06-10", horaInicio: "08:00", horaFin: "10:00", lugar: "Aula 12-B", formato: "punto" },
    { id: 3, titulo: "Reunión de trabajo colegiado", tipo: "administrativo", area: "Administrativa", fecha: "2026-06-10", horaInicio: "10:00", horaFin: "12:00", lugar: "Sala de juntas", formato: "punto" },
    { id: 4, titulo: "Torneo deportivo interplantel", tipo: "deportivo", area: "Deportiva", fecha: "2026-06-10", horaInicio: "13:00", horaFin: "17:00", lugar: "Plantel 01 – Tuxtla", formato: "punto" },
    { id: 5, titulo: "Capacitación docente", tipo: "formacion", area: "Formación", fecha: "2026-06-10", horaInicio: "16:00", horaFin: "18:00", lugar: "Aula 5", formato: "punto" },
    { id: 6, titulo: "Entrega de calificaciones", tipo: "academico", area: "Académica", fecha: "2026-06-12", horaInicio: "09:00", horaFin: "14:00", lugar: "Control escolar", formato: "punto" },
    { id: 7, titulo: "Ceremonia cívica", tipo: "institucional", area: "Institucional", fecha: "2026-06-22", horaInicio: "08:00", horaFin: "09:00", lugar: "Explanada", formato: "punto" },
    { id: 8, titulo: "Receso intersemestral", tipo: "institucional", area: "Institucional", fecha: "2026-06-28", horaInicio: "", horaFin: "", lugar: "Toda la comunidad", formato: "rango" },
    { id: 9, titulo: "Periodo vacacional", tipo: "urgente", area: "Institucional", fecha: "2026-06-30", horaInicio: "", horaFin: "", lugar: "Toda la comunidad", formato: "rango" },
  ];
}

const VISTAS = [
  { id: "mes", etiqueta: "Mes", icono: CalendarDays, disponible: true },
  { id: "semana", etiqueta: "Semana", icono: CalendarRange, disponible: false },
  { id: "anual", etiqueta: "Anual", icono: LayoutGrid, disponible: false },
  { id: "lista", etiqueta: "Lista", icono: List, disponible: false },
];

const FORM_EVENTO_VACIO = {
  titulo: "",
  tipo: "academico",
  area: "Académica",
  fecha: "",
  fechaFin: "",
  horaInicio: "",
  horaFin: "",
  lugar: "",
  formato: "punto",
};

const FORM_TIPO_VACIO = { id: null, etiqueta: "", color: "azul" };

export default function Calendario() {
  const hoy = useMemo(() => ahoraMexico(), []);
  const claveHoy = aClaveFecha(hoy);

  const [tipos, setTipos] = useState(TIPOS_INICIALES);
  const [eventos, setEventos] = useState(() => eventosIniciales());
  const [mesVisible, setMesVisible] = useState(
    () => new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  );
  const [vista, setVista] = useState("mes");
  const [fechaSeleccionada, setFechaSeleccionada] = useState(claveHoy);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroArea, setFiltroArea] = useState("todas");
  const [pickerAbierto, setPickerAbierto] = useState(false);
  const [anioPicker, setAnioPicker] = useState(() => mesVisible.getFullYear());
  const [vistaMenu, setVistaMenu] = useState(false);

  const [modalEvento, setModalEvento] = useState(false);
  const [formEvento, setFormEvento] = useState(FORM_EVENTO_VACIO);
  const [eventoEditando, setEventoEditando] = useState(null);

  const [modalEliminar, setModalEliminar] = useState(null);

  const [modalTipo, setModalTipo] = useState(false);
  const [formTipo, setFormTipo] = useState(FORM_TIPO_VACIO);

  const pickerRef = useRef(null);
  const vistaRef = useRef(null);

  useEffect(() => {
    const alClicar = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerAbierto(false);
      }
      if (vistaRef.current && !vistaRef.current.contains(e.target)) {
        setVistaMenu(false);
      }
    };
    document.addEventListener("mousedown", alClicar);
    return () => document.removeEventListener("mousedown", alClicar);
  }, []);

  const tiposPorId = useMemo(() => {
    const mapa = new Map();
    for (const t of tipos) mapa.set(t.id, t);
    return mapa;
  }, [tipos]);

  const colorTipo = (id) => tiposPorId.get(id)?.color ?? "gris";
  const etiquetaTipo = (id) => tiposPorId.get(id)?.etiqueta ?? "Sin tipo";

  const semestre = calcularSemestre(mesVisible);

  const eventosFiltrados = useMemo(() => {
    return eventos.filter((ev) => {
      if (filtroTipo !== "todos" && ev.tipo !== filtroTipo) return false;
      if (filtroArea !== "todas" && ev.area !== filtroArea) return false;
      return true;
    });
  }, [eventos, filtroTipo, filtroArea]);

  const eventosPorDia = useMemo(() => {
    const mapa = new Map();
    const agregar = (clave, ev) => {
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave).push(ev);
    };
    for (const ev of eventosFiltrados) {
      const inicio = desdeClaveFecha(ev.fecha);
      const fin = ev.fechaFin ? desdeClaveFecha(ev.fechaFin) : inicio;
      const cursor = new Date(inicio);
      while (cursor <= fin) {
        agregar(aClaveFecha(cursor), ev);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => (a.horaInicio || "").localeCompare(b.horaInicio || ""));
    }
    return mapa;
  }, [eventosFiltrados]);

  const celdas = useMemo(() => {
    const anio = mesVisible.getFullYear();
    const mes = mesVisible.getMonth();
    const primerDiaSemana = new Date(anio, mes, 1).getDay();
    const inicio = new Date(anio, mes, 1 - primerDiaSemana);

    return Array.from({ length: 42 }, (_, i) => {
      const fecha = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
      const clave = aClaveFecha(fecha);
      return {
        clave,
        dia: fecha.getDate(),
        diaSemana: fecha.getDay(),
        delMes: fecha.getMonth() === mes,
        esHoy: clave === claveHoy,
        eventos: eventosPorDia.get(clave) || [],
      };
    });
  }, [mesVisible, eventosPorDia, claveHoy]);

  const eventosDelDia = fechaSeleccionada
    ? (eventosPorDia.get(fechaSeleccionada) || [])
    : [];

  // Navegación
  const irMes = (delta) =>
    setMesVisible((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));

  const irHoy = () => {
    setMesVisible(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    setFechaSeleccionada(claveHoy);
  };

  const elegirMes = (mes) => {
    setMesVisible(new Date(anioPicker, mes, 1));
    setPickerAbierto(false);
  };

  // CRUD de eventos
  const abrirNuevoEvento = () => {
    setEventoEditando(null);
    setFormEvento({ ...FORM_EVENTO_VACIO, fecha: fechaSeleccionada || claveHoy });
    setModalEvento(true);
  };

  const abrirEditarEvento = (ev) => {
    setEventoEditando(ev.id);
    setFormEvento({
      titulo: ev.titulo,
      tipo: ev.tipo,
      area: ev.area,
      fecha: ev.fecha,
      fechaFin: ev.fechaFin || "",
      horaInicio: ev.horaInicio || "",
      horaFin: ev.horaFin || "",
      lugar: ev.lugar || "",
      formato: ev.formato || "punto",
    });
    setModalEvento(true);
  };

  const duplicarEvento = (ev) => {
    setEventos((prev) => [
      ...prev,
      { ...ev, id: Date.now(), titulo: `${ev.titulo} (copia)` },
    ]);
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
      setEventos((prev) =>
        prev.map((ev) => (ev.id === eventoEditando ? { ...ev, ...datos } : ev))
      );
    } else {
      setEventos((prev) => [...prev, { ...datos, id: Date.now() }]);
    }
    setFechaSeleccionada(datos.fecha);
    const fecha = desdeClaveFecha(datos.fecha);
    setMesVisible(new Date(fecha.getFullYear(), fecha.getMonth(), 1));
    setModalEvento(false);
  };

  const confirmarEliminar = () => {
    setEventos((prev) => prev.filter((ev) => ev.id !== modalEliminar.id));
    setModalEliminar(null);
  };

  // CRUD de tipos */
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

  // Exportar (.ics) */
  const exportarMes = () => {
    const anio = mesVisible.getFullYear();
    const mes = mesVisible.getMonth();
    const delMes = eventosFiltrados.filter((ev) => {
      const f = desdeClaveFecha(ev.fecha);
      return f.getFullYear() === anio && f.getMonth() === mes;
    });

    const lineas = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//COBACH//Agenda Escolar Digital//ES",
    ];
    for (const ev of delMes) {
      const dtIni = ev.fecha.replaceAll("-", "");
      const dtFin = (ev.fechaFin || ev.fecha).replaceAll("-", "");
      lineas.push("BEGIN:VEVENT");
      lineas.push(`UID:${ev.id}@cobach`);
      if (ev.horaInicio) {
        lineas.push(`DTSTART:${dtIni}T${ev.horaInicio.replace(":", "")}00`);
        if (ev.horaFin) lineas.push(`DTEND:${dtIni}T${ev.horaFin.replace(":", "")}00`);
      } else {
        lineas.push(`DTSTART;VALUE=DATE:${dtIni}`);
        lineas.push(`DTEND;VALUE=DATE:${dtFin}`);
      }
      lineas.push(`SUMMARY:${ev.titulo}`);
      if (ev.lugar) lineas.push(`LOCATION:${ev.lugar}`);
      lineas.push("END:VEVENT");
    }
    lineas.push("END:VCALENDAR");

    const blob = new Blob([lineas.join("\r\n")], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `calendario-${anio}-${String(mes + 1).padStart(2, "0")}.ics`;
    enlace.click();
    URL.revokeObjectURL(url);
  };

  const tipoEnUso = (id) => eventos.some((ev) => ev.tipo === id);

  return (
    <div className={styles["calendario"]}>
      <header className={styles["calendario__encabezado"]}>
        <div>
          <h2 className={styles["calendario__titulo"]}>Calendario institucional</h2>
          <span className={`etiqueta etiqueta--rojo ${styles["calendario__semestre"]}`}>
            SEMESTRE {semestre.ciclo}-{semestre.letra}
          </span>
        </div>
      </header>

      <div className={styles["calendario__cuerpo"]}>
        <div className={styles["calendario__principal"]}>
          <div className={styles["barra"]}>
            <div className={styles["barra__navegacion"]}>
          <button type="button" className="boton boton--fantasma boton--pequeno" onClick={irHoy}>
            Hoy
          </button>
          <button
            type="button"
            className={styles["barra__flecha"]}
            onClick={() => irMes(-1)}
            aria-label="Mes anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className={styles["barra__flecha"]}
            onClick={() => irMes(1)}
            aria-label="Mes siguiente"
          >
            <ChevronRight size={18} />
          </button>

          <div className={styles["barra__mes"]} ref={pickerRef}>
            <button
              type="button"
              className={styles["barra__mes-boton"]}
              onClick={() => {
                setAnioPicker(mesVisible.getFullYear());
                setPickerAbierto((v) => !v);
              }}
            >
              {NOMBRES_MES[mesVisible.getMonth()]} {mesVisible.getFullYear()}
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
                    const activo =
                      i === mesVisible.getMonth() && anioPicker === mesVisible.getFullYear();
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
        </div>

        <div className={styles["barra__derecha"]}>
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
                {VISTAS.map(({ id, etiqueta, icono: Icono, disponible }) => (
                  <button
                    key={id}
                    type="button"
                    role="option"
                    aria-selected={vista === id}
                    disabled={!disponible}
                    className={`${styles["vista__item"]} ${vista === id ? styles["vista__item--activa"] : ""}`}
                    onClick={() => {
                      if (!disponible) return;
                      setVista(id);
                      setVistaMenu(false);
                    }}
                  >
                    <Icono size={16} />
                    <span className={styles["vista__item-texto"]}>{etiqueta}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button type="button" className="boton boton--fantasma" onClick={exportarMes}>
            <Download size={16} />
            Exportar
          </button>
          <button type="button" className="boton boton--primario" onClick={abrirNuevoEvento}>
            <Plus size={16} />
            Nuevo evento
          </button>
            </div>
          </div>

          <div className="tarjeta">
            <div className={styles["mes"]}>
              <div className={styles["mes__cabecera"]}>
                {DIAS_SEMANA.map((dia) => (
                  <span key={dia} className={styles["mes__dia-semana"]}>
                    {dia}
                  </span>
                ))}
              </div>

              <div className={styles["mes__rejilla"]}>
                {celdas.map((celda) => {
                  const seleccionada = celda.clave === fechaSeleccionada;
                  const barras = celda.eventos
                    .filter(esBarra)
                    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
                  const puntos = celda.eventos.filter((e) => !esBarra(e));
                  return (
                    <button
                      type="button"
                      key={celda.clave}
                      onClick={() => setFechaSeleccionada(celda.clave)}
                      aria-pressed={seleccionada}
                      className={`${styles["mes__celda"]} ${
                        celda.delMes ? "" : styles["mes__celda--fuera"]
                      } ${seleccionada ? styles["mes__celda--sel"] : ""}`}
                    >
                      <span
                        className={`${styles["mes__numero"]} ${
                          celda.esHoy ? styles["mes__numero--hoy"] : ""
                        } ${celda.diaSemana === 0 ? styles["mes__numero--domingo"] : ""}`}
                      >
                        {celda.dia}
                      </span>

                      <span className={styles["mes__eventos"]}>
                        <span className={styles["mes__bandas"]}>
                          {barras.map((ev) => {
                            const fin = ev.fechaFin || ev.fecha;
                            const esInicio = celda.clave === ev.fecha;
                            const esFin = celda.clave === fin;
                            const abreSemana = celda.diaSemana === 0;
                            const cierraSemana = celda.diaSemana === 6;
                            const nombre = esInicio || abreSemana;
                            return (
                              <span
                                key={ev.id}
                                title={ev.titulo}
                                className={`${styles["mes__banda"]} ${styles[`mes__banda--${colorTipo(ev.tipo)}`]} ${
                                  esInicio || abreSemana ? styles["mes__banda--inicio"] : ""
                                } ${esFin || cierraSemana ? styles["mes__banda--fin"] : ""}`}
                              >
                                <span className={styles["mes__banda-texto"]}>
                                  {nombre ? ev.titulo : " "}
                                </span>
                              </span>
                            );
                          })}
                        </span>

                        {puntos.length > 0 && (
                          <span className={styles["mes__puntos"]}>
                            {puntos.map((ev) => (
                              <span
                                key={ev.id}
                                className={`${styles["mes__punto"]} ${styles[`mes__punto--${colorTipo(ev.tipo)}`]}`}
                                title={ev.titulo}
                              />
                            ))}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={`tarjeta ${styles["panel-dia"]}`}>
            <div className={styles["panel-dia__cabecera"]}>
              <h3 className={styles["panel-dia__titulo"]}>
                {fechaSeleccionada ? formatoFechaLarga(fechaSeleccionada) : "Selecciona un día"}
              </h3>
              <span className={styles["panel-dia__conteo"]}>
                {eventosDelDia.length}{" "}
                {eventosDelDia.length === 1 ? "evento" : "eventos"}
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

        <aside className={styles["calendario__aside"]}>
          <article className="tarjeta">
            <div className="tarjeta__cabecera">
              <div className="tarjeta__titulo">
                <Tag size={16} />
                Simbología
              </div>
            </div>
            <ul className={styles["simbologia"]}>
              {SIMBOLOGIA.map((s) => (
                <li key={s.etiqueta} className={styles["simbologia__item"]}>
                  <span className={`${styles["simbologia__marca"]} ${styles[`simbologia__marca--${s.forma}`]} ${styles[`simbologia__color--${s.color}`]}`} />
                  <span className={styles["simbologia__texto"]}>{s.etiqueta}</span>
                </li>
              ))}
            </ul>
          </article>

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

      {/* Modal: crear / editar evento */}
      <Modal
        abierto={modalEvento}
        titulo={eventoEditando ? "Editar evento" : "Nuevo evento"}
        onCerrar={() => setModalEvento(false)}
        pie={
          <>
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
              <option value="punto">Punto (evento puntual)</option>
              <option value="rango">Barra (periodo / todo el día)</option>
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

      {/* Modal: crear / editar tipo */}
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
