import { useEffect, useMemo, useState } from "react";
import {
  Inbox, Clock, CheckCircle2, Search, Check, X, Pencil, Trash2,
  MapPin, Mail, Eye, RefreshCw, ShieldOff,
} from "lucide-react";
import Modal from "../../../components/modal/Modal.jsx";
import { avisoExito, avisoError, confirmarAccion } from "../../../lib/alertas.js";
import { TURNOS } from "../../../data/usuarios.js";
import { listarSolicitudes, resolverSolicitud, eliminarSolicitud, editarSolicitud } from "../../../services/solicitudesService.js";
import { obtenerTurnos } from "../../../services/authService.js";
import { useSolicitudesCtx } from "../../../context/SolicitudesContext.jsx";
import { iniciales } from "../../../lib/texto.js";
import styles from "../usuarios/usuarios.module.css";

const TURNOS_MAP = Object.fromEntries(TURNOS.map((t) => [t.id, t]));

const TIPOS = {
  visualizacion: { etiqueta: "Visualizar plantel", color: "azul", icono: Eye },
  turno: { etiqueta: "Cambio de turno", color: "morado", icono: RefreshCw },
};

const ESTADOS_SOLICITUD = [
  { id: "pendiente", etiqueta: "Pendiente", color: "naranja" },
  { id: "aceptada", etiqueta: "Aceptada", color: "verde" },
  { id: "rechazada", etiqueta: "Rechazada", color: "rojo" },
  { id: "revocada", etiqueta: "Revocada", color: "gris" },
];
const ESTADOS_MAP = Object.fromEntries(ESTADOS_SOLICITUD.map((e) => [e.id, e]));

function formatoFecha(iso) {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  const fecha = new Date(a, m - 1, d);
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(fecha);
}

// Solicitudes de visualización de plantel y cambio de turno de docentes y
// administrativos: las resuelven los administradores del plantel destino
// (aceptar, rechazar o editar el turno antes de aceptar).
export default function Solicitudes() {
  const { refrescar: refrescarBadge } = useSolicitudesCtx();
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [turnosDisponibles, setTurnosDisponibles] = useState([]);

  const [editando, setEditando] = useState(null); // solicitud en edición
  const [formTurno, setFormTurno] = useState("");

  const [reintento, setReintento] = useState(0);
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setErrorCarga(false);
    Promise.all([listarSolicitudes(null, "visualizacion,turno"), obtenerTurnos()])
      .then(([datos, turnos]) => {
        if (!vigente) return;
        setSolicitudes(datos);
        setTurnosDisponibles(turnos);
      })
      .catch(() => { if (vigente) setErrorCarga(true); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [reintento]);

  const totales = useMemo(() => ({
    total: solicitudes.length,
    pendientes: solicitudes.filter((s) => s.estado === "pendiente").length,
    aceptadas: solicitudes.filter((s) => s.estado === "aceptada").length,
  }), [solicitudes]);

  const solicitudesFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return solicitudes.filter((s) => {
      if (filtroEstado !== "todos" && s.estado !== filtroEstado) return false;
      if (filtroTipo !== "todos" && s.tipo !== filtroTipo) return false;
      if (!termino) return true;
      return (
        (s.nombre || "").toLowerCase().includes(termino) ||
        (s.correo || "").toLowerCase().includes(termino) ||
        (s.plantel || "").toLowerCase().includes(termino)
      );
    });
  }, [solicitudes, busqueda, filtroEstado, filtroTipo]);

  const hayFiltros = busqueda.trim() || filtroEstado !== "todos" || filtroTipo !== "todos";

  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroEstado("todos");
    setFiltroTipo("todos");
  };

  const actualizarFila = (solicitud) =>
    setSolicitudes((prev) => prev.map((s) => (s.id === solicitud.id ? solicitud : s)));

  const aceptar = async (s) => {
    const turnoEtiqueta = TURNOS_MAP[s.turno]?.etiqueta || s.turno || "—";
    const html = s.tipo === "visualizacion"
      ? `¿Conceder a <b>${s.nombre}</b> la visualización del plantel <b>${s.plantel}</b> en turno <b>${turnoEtiqueta}</b>?`
      : `¿Cambiar el turno de <b>${s.nombre}</b> en <b>${s.plantel}</b> a <b>${turnoEtiqueta}</b>?`;
    const { isConfirmed } = await confirmarAccion({
      icono: "question",
      titulo: s.tipo === "visualizacion" ? "Aceptar visualización" : "Aceptar cambio de turno",
      html: s.motivo ? `${html}<br/><br/><small>Motivo: ${s.motivo}</small>` : html,
      confirmar: "Aceptar",
    });
    if (!isConfirmed) return;
    try {
      const actualizada = await resolverSolicitud(s.id, "aceptar");
      actualizarFila(actualizada);
      refrescarBadge();
      avisoExito(s.tipo === "visualizacion" ? "Visualización de plantel concedida" : "Turno actualizado");
    } catch (err) {
      avisoError(err.message || "No se pudo aceptar la solicitud");
    }
  };

  const rechazar = async (s) => {
    const htmlRechazar = `¿Seguro que deseas rechazar la solicitud de <b>${s.nombre}</b>?`;
    const { isConfirmed } = await confirmarAccion({
      titulo: "Rechazar solicitud",
      html: s.motivo ? `${htmlRechazar}<br/><br/><small>Motivo: ${s.motivo}</small>` : htmlRechazar,
      confirmar: "Rechazar",
      peligro: true,
    });
    if (!isConfirmed) return;
    try {
      const actualizada = await resolverSolicitud(s.id, "rechazar");
      actualizarFila(actualizada);
      refrescarBadge();
      avisoExito("Solicitud rechazada");
    } catch (err) {
      avisoError(err.message || "No se pudo rechazar la solicitud");
    }
  };

  const revocar = async (s) => {
    const { isConfirmed } = await confirmarAccion({
      titulo: "Revocar visualización",
      html: `¿Seguro que deseas revocar el acceso de <b>${s.nombre}</b> para visualizar el plantel <b>${s.plantel}</b>? Dejará de ver sus eventos de inmediato.`,
      confirmar: "Revocar",
      peligro: true,
    });
    if (!isConfirmed) return;
    try {
      const actualizada = await resolverSolicitud(s.id, "revocar");
      actualizarFila(actualizada);
      avisoExito("Visualización de plantel revocada");
    } catch (err) {
      avisoError(err.message || "No se pudo revocar la visualización");
    }
  };

  const eliminar = async (s) => {
    const { isConfirmed } = await confirmarAccion({
      titulo: "Eliminar solicitud",
      html: `¿Seguro que deseas eliminar la solicitud de <b>${s.nombre}</b>? Esta acción no se puede deshacer.`,
      confirmar: "Eliminar",
      peligro: true,
    });
    if (!isConfirmed) return;
    try {
      await eliminarSolicitud(s.id);
    } catch (err) {
      avisoError(err.message || "No se pudo eliminar la solicitud");
      return;
    }
    setSolicitudes((prev) => prev.filter((x) => x.id !== s.id));
    avisoExito("Solicitud eliminada");
  };

  const abrirEditar = (s) => {
    setEditando(s);
    setFormTurno(s.turno_id ? String(s.turno_id) : "");
  };

  const guardarEdicion = async (e) => {
    e.preventDefault();
    if (!editando || !formTurno) return;
    try {
      const actualizada = await editarSolicitud(editando.id, { turno_id: Number(formTurno) });
      actualizarFila(actualizada);
      setEditando(null);
      avisoExito("Solicitud actualizada");
    } catch (err) {
      avisoError(err.message || "No se pudo editar la solicitud");
    }
  };

  return (
    <section className={styles["pagina"]}>
      <header className={styles["encabezado"]}>
        <div>
          <h2 className={styles["encabezado__titulo"]}>Solicitudes</h2>
          <p className={styles["encabezado__subtitulo"]}>
            Atiende las solicitudes de visualización de plantel y cambio de turno de docentes y administrativos.
          </p>
        </div>
      </header>

      <div className={styles["indicadores"]}>
        <article className={styles["indicador"]}>
          <span className={`${styles["indicador__icono"]} ${styles["indicador__icono--azul"]}`}>
            <Inbox size={20} />
          </span>
          <div>
            <div className={styles["indicador__valor"]}>{totales.total}</div>
            <div className={styles["indicador__etiqueta"]}>Solicitudes totales</div>
          </div>
        </article>
        <article className={styles["indicador"]}>
          <span className={`${styles["indicador__icono"]} ${styles["indicador__icono--naranja"]}`}>
            <Clock size={20} />
          </span>
          <div>
            <div className={styles["indicador__valor"]}>{totales.pendientes}</div>
            <div className={styles["indicador__etiqueta"]}>Pendientes</div>
          </div>
        </article>
        <article className={styles["indicador"]}>
          <span className={`${styles["indicador__icono"]} ${styles["indicador__icono--verde"]}`}>
            <CheckCircle2 size={20} />
          </span>
          <div>
            <div className={styles["indicador__valor"]}>{totales.aceptadas}</div>
            <div className={styles["indicador__etiqueta"]}>Aceptadas</div>
          </div>
        </article>
      </div>

      <article className="tarjeta">
        <div className={styles["barra"]}>
          <div className={styles["buscador"]}>
            <Search size={16} />
            <input
              type="search"
              placeholder="Buscar por nombre, correo o plantel..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div className={styles["filtros"]}>
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} aria-label="Filtrar por tipo">
              <option value="todos">Todos los tipos</option>
              {Object.entries(TIPOS).map(([id, t]) => (
                <option key={id} value={id}>{t.etiqueta}</option>
              ))}
            </select>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} aria-label="Filtrar por estado">
              <option value="todos">Todos los estados</option>
              {ESTADOS_SOLICITUD.map((e) => (
                <option key={e.id} value={e.id}>{e.etiqueta}</option>
              ))}
            </select>
            {hayFiltros && (
              <button type="button" className="tarjeta__enlace" onClick={limpiarFiltros}>
                Limpiar
              </button>
            )}
          </div>
        </div>

        {cargando ? (
          <p className={styles["vacio"]}>Cargando solicitudes…</p>
        ) : errorCarga ? (
          <div className={styles["vacio"]}>
            <p>No se pudieron cargar las solicitudes.</p>
            <button
              type="button"
              className="boton boton--fantasma"
              onClick={() => setReintento((n) => n + 1)}
            >
              Reintentar
            </button>
          </div>
        ) : solicitudesFiltradas.length === 0 ? (
          <p className={styles["vacio"]}>
            {solicitudes.length === 0
              ? "Aún no hay solicitudes de visualización o cambio de turno."
              : "No se encontraron solicitudes con esos criterios."}
          </p>
        ) : (
          <div className={styles["tabla-envoltura"]}>
            <table className={styles["tabla"]}>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Tipo</th>
                  <th>Plantel</th>
                  <th>Turno solicitado</th>
                  <th>Estado</th>
                  <th>Solicitada</th>
                  <th className={styles["tabla__acciones-col"]}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {solicitudesFiltradas.map((s) => {
                  const tipo = TIPOS[s.tipo];
                  const estado = ESTADOS_MAP[s.estado];
                  const turno = TURNOS_MAP[s.turno];
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className={styles["usuario"]}>
                          <span className={`${styles["usuario__avatar"]} ${styles[`usuario__avatar--${tipo?.color || "azul"}`]}`}>
                            {iniciales(s.nombre)}
                          </span>
                          <div className={styles["usuario__copia"]}>
                            <span className={styles["usuario__nombre"]}>{s.nombre}</span>
                            <span className={styles["usuario__correo"]}>
                              <Mail size={11} />
                              {s.correo}
                            </span>
                            {s.estado === "pendiente" && s.motivo && (
                              <span className={styles["usuario__motivo"]} title={s.motivo}>
                                “{s.motivo}”
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td data-label="Tipo">
                        <span className={`etiqueta etiqueta--${tipo?.color || "gris"}`} title={s.motivo || undefined}>
                          {tipo?.etiqueta || s.tipo}
                        </span>
                      </td>
                      <td data-label="Plantel">
                        {s.plantel ? (
                          <span className={styles["plantel-chip"]}>
                            <MapPin size={11} />
                            {s.plantel}
                          </span>
                        ) : (
                          <span className={styles["tabla__tenue"]}>—</span>
                        )}
                      </td>
                      <td data-label="Turno">
                        {turno ? (
                          <span className={`etiqueta etiqueta--${turno.color}`}>{turno.etiqueta}</span>
                        ) : (
                          <span className={styles["tabla__tenue"]}>—</span>
                        )}
                      </td>
                      <td data-label="Estado">
                        <span className={`etiqueta etiqueta--${estado?.color}`}>{estado?.etiqueta}</span>
                      </td>
                      <td data-label="Solicitada" className={styles["tabla__tenue"]}>{formatoFecha(s.fecha_solicitud)}</td>
                      <td>
                        <div className={styles["acciones"]}>
                          {s.estado === "pendiente" && (
                            <>
                              <button
                                type="button"
                                className={styles["acciones__aceptar"]}
                                onClick={() => aceptar(s)}
                                aria-label="Aceptar"
                                title="Aceptar solicitud"
                              >
                                <Check size={15} />
                              </button>
                              <button
                                type="button"
                                className={styles["acciones__rechazar"]}
                                onClick={() => rechazar(s)}
                                aria-label="Rechazar"
                                title="Rechazar"
                              >
                                <X size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => abrirEditar(s)}
                                aria-label="Editar"
                                title="Editar turno"
                              >
                                <Pencil size={15} />
                              </button>
                            </>
                          )}
                          {s.tipo === "visualizacion" && s.estado === "aceptada" && (
                            <button
                              type="button"
                              className={styles["acciones__revocar"]}
                              onClick={() => revocar(s)}
                              aria-label="Revocar visualización"
                              title="Revocar visualización del plantel"
                            >
                              <ShieldOff size={15} />
                            </button>
                          )}
                          {s.estado !== "pendiente" && (
                            <button
                              type="button"
                              className={styles["acciones__borrar"]}
                              onClick={() => eliminar(s)}
                              aria-label="Eliminar solicitud"
                              title="Eliminar solicitud"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {/* Modal: editar turno de una solicitud pendiente */}
      <Modal
        abierto={!!editando}
        titulo="Editar solicitud"
        onCerrar={() => setEditando(null)}
        pie={
          <>
            <button type="button" className="boton boton--fantasma" onClick={() => setEditando(null)}>
              Cancelar
            </button>
            <button type="submit" form="form-solicitud" className="boton boton--primario" disabled={!formTurno}>
              Guardar cambios
            </button>
          </>
        }
      >
        {editando && (
          <form id="form-solicitud" className="formulario" onSubmit={guardarEdicion}>
            <div className="formulario__campo">
              <span className="formulario__etiqueta">Usuario</span>
              <div className={styles["usuario"]}>
                <span className={`${styles["usuario__avatar"]} ${styles[`usuario__avatar--${TIPOS[editando.tipo]?.color || "azul"}`]}`}>
                  {iniciales(editando.nombre)}
                </span>
                <div className={styles["usuario__copia"]}>
                  <span className={styles["usuario__nombre"]}>{editando.nombre}</span>
                  <span className={styles["usuario__correo"]}>
                    <Mail size={11} />
                    {editando.correo}
                  </span>
                </div>
              </div>
            </div>

            <div className="formulario__campo">
              <span className="formulario__etiqueta">Solicitud</span>
              <span className={styles["plantel-chip"]}>
                <MapPin size={11} />
                {TIPOS[editando.tipo]?.etiqueta || editando.tipo} — {editando.plantel || "—"}
              </span>
            </div>

            <label className="formulario__campo">
              <span className="formulario__etiqueta">Turno</span>
              <select value={formTurno} onChange={(e) => setFormTurno(e.target.value)} required>
                <option value="" disabled>Selecciona un turno</option>
                {turnosDisponibles.map((t) => (
                  <option key={t.id} value={String(t.id)}>{t.nombre}</option>
                ))}
              </select>
            </label>

            {editando.motivo && (
              <div className="formulario__campo">
                <span className="formulario__etiqueta">Motivo del solicitante</span>
                <p className={styles["rol-nota"]}>{editando.motivo}</p>
              </div>
            )}
          </form>
        )}
      </Modal>
    </section>
  );
}
