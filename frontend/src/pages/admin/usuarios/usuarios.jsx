import { useEffect, useMemo, useState } from "react";
import {
  Users, UserCheck, Clock, Search, Plus, Check, X, Pencil, Trash2,
  MapPin, ShieldCheck, Mail,
} from "lucide-react";
import Modal from "../../../components/modal/Modal.jsx";
import { avisoExito, avisoError, confirmarAccion, confirmarEliminacion } from "../../../lib/alertas.js";
import { ROL, ROLES_GESTION, ESTADOS, TURNOS } from "../../../data/usuarios.js";
import { listarSolicitudes, listarAdministradores, resolverSolicitud, eliminarSolicitud, crearAdmin, actualizarAdmin } from "../../../services/solicitudesService.js";
import { obtenerPlanteles, obtenerTurnos } from "../../../services/authService.js";
import BuscadorPlantelInline from "../../../components/buscador-plantel/BuscadorPlantelInline.jsx";
import BuscadorUsuarioInline from "../../../components/buscador-usuario/BuscadorUsuarioInline.jsx";
import { iniciales } from "../../../lib/texto.js";
import { useCampoFormulario } from "../../../hooks/useCampoFormulario.js";
import styles from "./usuarios.module.css";

const ESTADOS_MAP = Object.fromEntries(ESTADOS.map((e) => [e.id, e]));
const TURNOS_MAP = Object.fromEntries(TURNOS.map((t) => [t.id, t]));

const ESTADO_BACKEND = { pendiente: "pendiente", aceptada: "activo", rechazada: "rechazado" };

function solicitudAFila(s) {
  return {
    id: `sol-${s.id}`,
    solicitudId: s.id,
    id_usuario: s.id_usuario,
    origenBackend: true,
    nombre: s.nombre,
    correo: s.correo,
    rol: "admin",
    turno: s.turno || "matutino",
    planteles: s.plantel ? [s.plantel] : [],
    estado: ESTADO_BACKEND[s.estado] || "pendiente",
    solicitado: (s.fecha_solicitud || "").slice(0, 10),
  };
}

function adminAFila(u) {
  const primera = u.planteles?.[0];
  const rol = u.rol || "admin";
  return {
    id: `adm-${u.id}`,
    id_usuario: u.id,
    origenBackend: false,
    nombre: u.nombre,
    correo: u.correo,
    rol,
    turno: primera?.turno ? primera.turno.toLowerCase() : (rol === "colaborador" ? null : "matutino"),
    planteles: (u.planteles || []).map((p) => p.plantel).filter(Boolean),
    estado: "activo",
    solicitado: "",
  };
}

const ROLES_EDICION = [
  { id: "admin", etiqueta: "Administrador" },
  { id: "colaborador", etiqueta: "Colaborador" },
  { id: "docente", etiqueta: "Docente / Administrativo" },
];

const FORM_VACIO = { nombre: "", correo: "", turno: "matutino", planteles: [], usuarioId: null, rol: "admin" };

function formatoFecha(clave) {
  if (!clave) return "—";
  const [a, m, d] = clave.split("-").map(Number);
  const fecha = new Date(a, m - 1, d);
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(fecha);
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [plantelesDisponibles, setPlantelesDisponibles] = useState([]);
  const [turnosDisponibles, setTurnosDisponibles] = useState([]);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [editando, setEditando] = useState(null);
  const [modoBusqueda, setModoBusqueda] = useState("correo");

  const [reintento, setReintento] = useState(0);
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setErrorCarga(false);
    Promise.all([listarSolicitudes(null, "admin"), listarAdministradores(), obtenerPlanteles(), obtenerTurnos()])
      .then(([solicitudes, admins, planteles, turnos]) => {
        if (!vigente) return;
        // Los admins activos (creados directo o por solicitud aceptada) vienen de
        // /api/usuarios?rol=admin. Las solicitudes aceptadas ya son admins (o dejaron
        // de serlo si se les revocó), así que de las solicitudes solo se conservan
        // las pendientes/rechazadas (sin duplicar).
        const correosAdmin = new Set(admins.map((a) => a.correo));
        const filasSolicitudes = solicitudes
          .filter((s) => s.estado !== "aceptada" && !correosAdmin.has(s.correo))
          .map(solicitudAFila);
        setUsuarios([...filasSolicitudes, ...admins.map(adminAFila)]);
        setPlantelesDisponibles(planteles);
        setTurnosDisponibles(turnos);
      })
      .catch(() => { if (vigente) setErrorCarga(true); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [reintento]);

  const totales = useMemo(() => ({
    total: usuarios.length,
    pendientes: usuarios.filter((u) => u.estado === "pendiente").length,
    activos: usuarios.filter((u) => u.estado === "activo").length,
  }), [usuarios]);

  const usuariosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (filtroEstado !== "todos" && u.estado !== filtroEstado) return false;
      if (!termino) return true;
      const enPlanteles = u.planteles.some((p) => p.toLowerCase().includes(termino));
      return (
        u.nombre.toLowerCase().includes(termino) ||
        u.correo.toLowerCase().includes(termino) ||
        enPlanteles
      );
    });
  }, [usuarios, busqueda, filtroEstado]);

  const hayFiltros = busqueda.trim() || filtroEstado !== "todos";

  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroEstado("todos");
  };

  const abrirNuevo = () => {
    setEditando(null);
    setForm(FORM_VACIO);
    setModoBusqueda("correo");
    setModalAbierto(true);
  };

  const abrirEditar = (usuario) => {
    setEditando(usuario.id);
    setForm({
      nombre: usuario.nombre,
      correo: usuario.correo,
      turno: usuario.turno || "matutino",
      planteles: [...usuario.planteles],
      usuarioId: usuario.id_usuario ?? null,
      rol: usuario.rol || "admin",
    });
    setModalAbierto(true);
  };

  const fijarCampo = useCampoFormulario(setForm);

  // Un único plantel permitido por admin: seleccionar uno deselecciona el anterior.
  const alternarPlantel = (plantel) =>
    setForm((prev) => ({
      ...prev,
      planteles: prev.planteles.includes(plantel) ? [] : [plantel],
    }));

  const _turnoIdDesdeForm = () => {
    const nombre = form.turno;
    return turnosDisponibles.find((t) => t.nombre.toLowerCase() === nombre.toLowerCase())?.id ?? null;
  };

  const _plantelIdDesdeForm = () => {
    const nombrePlantel = form.planteles[0];
    return plantelesDisponibles.find((p) => p.nombre === nombrePlantel)?.id ?? null;
  };

  const guardar = async (e) => {
    e.preventDefault();
    const rolFinal = form.rol;

    const nombre = form.nombre.trim();
    const correo = form.correo.trim();
    const plantelId = _plantelIdDesdeForm();
    const turnoId = _turnoIdDesdeForm();

    if (editando) {
      if (rolFinal === "admin" && form.planteles.length === 0) return;
      const usuarioEditando = usuarios.find((u) => u.id === editando);
      if (usuarioEditando?.id_usuario) {
        const payload = { nombre, rol: form.rol };
        if (rolFinal === "admin" && plantelId && turnoId) {
          payload.plantel_id = plantelId;
          payload.turno_id = turnoId;
        }
        try {
          await actualizarAdmin(usuarioEditando.id_usuario, payload);
        } catch (err) {
          avisoError(err.message || "No se pudo actualizar el usuario");
          return;
        }
      }
      if (rolFinal === "docente") {
        setUsuarios((prev) => prev.filter((u) => u.id !== editando));
        setModalAbierto(false);
        avisoExito("Acceso revocado. El usuario volverá a su rol según sus credenciales institucionales.");
        return;
      }
      setUsuarios((prev) =>
        prev.map((u) =>
          u.id === editando
            ? {
                ...u,
                nombre,
                rol: rolFinal,
                turno: rolFinal === "admin" ? form.turno : null,
                planteles: rolFinal === "admin" ? [...form.planteles] : [],
              }
            : u,
        ),
      );
    } else {
      if (rolFinal === "admin" && modoBusqueda === "nombre" && (!plantelId || !turnoId)) {
        avisoError("Selecciona un plantel y turno.");
        return;
      }
      const payload = { correo, rol: rolFinal };
      if (nombre) payload.nombre = nombre;
      if (rolFinal === "admin") {
        if (turnoId) payload.turno_id = turnoId;
        if (plantelId) payload.plantel_id = plantelId;
      }
      let res;
      try {
        res = await crearAdmin(payload);
      } catch (err) {
        avisoError(err.message || "No se pudo crear el usuario");
        return;
      }
      setUsuarios((prev) => [
        ...prev,
        {
          id: `adm-${res.id_usuario}`,
          id_usuario: res.id_usuario,
          nombre: res.nombre,
          correo: res.correo,
          rol: res.rol || rolFinal,
          turno: res.turno,
          planteles: res.plantel ? [res.plantel] : [],
          estado: "activo",
          solicitado: new Date().toISOString().slice(0, 10),
          origenBackend: false,
        },
      ]);
    }

    setModalAbierto(false);
    avisoExito(
      editando
        ? "Usuario actualizado"
        : `${ROLES_GESTION[rolFinal]?.etiqueta || "Usuario"} agregado`,
    );
  };

  const aceptar = async (usuario) => {
    const { isConfirmed } = await confirmarAccion({
      icono: "question",
      titulo: "Aceptar administrador",
      html: `¿Conceder acceso a <b>${usuario.nombre}</b> como <b>${ROL.etiqueta}</b>? Su cuenta pasará a administrador y podrá gestionar el calendario.`,
      confirmar: "Aceptar",
    });
    if (!isConfirmed) return;
    if (usuario.origenBackend) {
      try {
        await resolverSolicitud(usuario.solicitudId, "aceptar");
      } catch (err) {
        avisoError(err.message || "No se pudo aceptar la solicitud");
        return;
      }
    }
    setUsuarios((prev) => prev.map((u) => (u.id === usuario.id ? { ...u, estado: "activo" } : u)));
    avisoExito("Administrador aceptado");
  };

  const rechazar = async (usuario) => {
    const { isConfirmed } = await confirmarAccion({
      titulo: "Rechazar solicitud",
      html: `¿Seguro que deseas rechazar a <b>${usuario.nombre}</b>? No podrá gestionar fechas.`,
      confirmar: "Rechazar",
      peligro: true,
    });
    if (!isConfirmed) return;
    if (usuario.origenBackend) {
      try {
        await resolverSolicitud(usuario.solicitudId, "rechazar");
      } catch (err) {
        avisoError(err.message || "No se pudo rechazar la solicitud");
        return;
      }
    }
    setUsuarios((prev) => prev.map((u) => (u.id === usuario.id ? { ...u, estado: "rechazado" } : u)));
    avisoExito("Solicitud rechazada");
  };

  const eliminar = async (usuario) => {
    const { isConfirmed } = await confirmarEliminacion(usuario.nombre);
    if (!isConfirmed) return;
    try {
      await eliminarSolicitud(usuario.solicitudId);
    } catch (err) {
      avisoError(err.message || "No se pudo eliminar la solicitud");
      return;
    }
    setUsuarios((prev) => prev.filter((u) => u.id !== usuario.id));
    avisoExito("Solicitud eliminada");
  };

  // Opciones de turno: desde BD si cargaron, si no desde TURNOS estáticos.
  const opcionesTurno = turnosDisponibles.length > 0
    ? turnosDisponibles.map((t) => ({ id: t.nombre.toLowerCase(), etiqueta: t.nombre }))
    : TURNOS;

  return (
    <section className={styles["pagina"]}>
      <header className={styles["encabezado"]}>
        <div>
          <h2 className={styles["encabezado__titulo"]}>Usuarios</h2>
          <p className={styles["encabezado__subtitulo"]}>
            Administra quién puede agregar y modificar fechas en cada plantel.
          </p>
        </div>
        <button type="button" className="boton boton--primario" onClick={abrirNuevo}>
          <Plus size={16} />
          Nuevo administrador
        </button>
      </header>

      <div className={styles["indicadores"]}>
        <article className={styles["indicador"]}>
          <span className={`${styles["indicador__icono"]} ${styles["indicador__icono--azul"]}`}>
            <Users size={20} />
          </span>
          <div>
            <div className={styles["indicador__valor"]}>{totales.total}</div>
            <div className={styles["indicador__etiqueta"]}>Usuarios totales</div>
          </div>
        </article>
        <article className={styles["indicador"]}>
          <span className={`${styles["indicador__icono"]} ${styles["indicador__icono--naranja"]}`}>
            <Clock size={20} />
          </span>
          <div>
            <div className={styles["indicador__valor"]}>{totales.pendientes}</div>
            <div className={styles["indicador__etiqueta"]}>Solicitudes pendientes</div>
          </div>
        </article>
        <article className={styles["indicador"]}>
          <span className={`${styles["indicador__icono"]} ${styles["indicador__icono--verde"]}`}>
            <UserCheck size={20} />
          </span>
          <div>
            <div className={styles["indicador__valor"]}>{totales.activos}</div>
            <div className={styles["indicador__etiqueta"]}>Administradores activos</div>
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
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} aria-label="Filtrar por estado">
              <option value="todos">Todos los estados</option>
              {ESTADOS.map((e) => (
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
          <p className={styles["vacio"]}>Cargando usuarios…</p>
        ) : errorCarga ? (
          <div className={styles["vacio"]}>
            <p>No se pudieron cargar los usuarios.</p>
            <button
              type="button"
              className="boton boton--fantasma"
              style={{ marginTop: 10 }}
              onClick={() => setReintento((n) => n + 1)}
            >
              Reintentar
            </button>
          </div>
        ) : usuariosFiltrados.length === 0 ? (
          <p className={styles["vacio"]}>
            {usuarios.length === 0
              ? "Aún no hay solicitudes ni administradores registrados."
              : "No se encontraron usuarios con esos criterios."}
          </p>
        ) : (
          <div className={styles["tabla-envoltura"]}>
            <table className={styles["tabla"]}>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Plantel asignado</th>
                  <th>Turno</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Solicitado</th>
                  <th className={styles["tabla__acciones-col"]}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map((u) => {
                  const estado = ESTADOS_MAP[u.estado];
                  const turno = TURNOS_MAP[u.turno];
                  const rolFila = ROLES_GESTION[u.rol] || ROL;
                  const colorRol = u.rol === "colaborador" ? ROL.color : rolFila.color;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className={styles["usuario"]}>
                          <span className={`${styles["usuario__avatar"]} ${styles[`usuario__avatar--${colorRol}`]}`}>
                            {iniciales(u.nombre)}
                          </span>
                          <div className={styles["usuario__copia"]}>
                            <span className={styles["usuario__nombre"]}>{u.nombre}</span>
                            <span className={styles["usuario__correo"]}>
                              <Mail size={11} />
                              {u.correo}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td data-label="Plantel">
                        {u.planteles.length > 0 ? (
                          <div className={styles["planteles"]}>
                            {u.planteles.map((p) => (
                              <span key={p} className={styles["plantel-chip"]}>
                                <MapPin size={11} />
                                {p}
                              </span>
                            ))}
                          </div>
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
                      <td data-label="Rol">
                        <span className={`etiqueta etiqueta--${colorRol}`}>{rolFila.etiqueta}</span>
                      </td>
                      <td data-label="Estado">
                        <span className={`etiqueta etiqueta--${estado?.color}`}>{estado?.etiqueta}</span>
                      </td>
                      <td data-label="Solicitado" className={styles["tabla__tenue"]}>{formatoFecha(u.solicitado)}</td>
                      <td>
                        <div className={styles["acciones"]}>
                          {u.estado !== "activo" && (
                            <button
                              type="button"
                              className={styles["acciones__aceptar"]}
                              onClick={() => aceptar(u)}
                              aria-label="Aceptar"
                              title="Aceptar como administrador"
                            >
                              <Check size={15} />
                            </button>
                          )}
                          {u.estado === "pendiente" && (
                            <button
                              type="button"
                              className={styles["acciones__rechazar"]}
                              onClick={() => rechazar(u)}
                              aria-label="Rechazar"
                              title="Rechazar"
                            >
                              <X size={15} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => abrirEditar(u)}
                            aria-label="Editar"
                            title="Editar"
                          >
                            <Pencil size={15} />
                          </button>
                          {u.estado !== "activo" && (
                            <button
                              type="button"
                              className={styles["acciones__borrar"]}
                              onClick={() => eliminar(u)}
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

      {/* Modal: crear / editar */}
      <Modal
        abierto={modalAbierto}
        titulo={editando ? "Editar usuario" : "Nuevo administrador"}
        onCerrar={() => setModalAbierto(false)}
        pie={
          <>
            <button type="button" className="boton boton--fantasma" onClick={() => setModalAbierto(false)}>
              Cancelar
            </button>
            <button type="submit" form="form-usuario" className="boton boton--primario">
              {editando ? "Guardar cambios" : "Agregar"}
            </button>
          </>
        }
      >
        <form id="form-usuario" className="formulario" onSubmit={guardar}>
          {!editando && (
            <div className={styles["modo-busqueda"]}>
              <button
                type="button"
                className={modoBusqueda === "correo" ? styles["modo-busqueda__activo"] : ""}
                onClick={() => { setModoBusqueda("correo"); setForm((prev) => ({ ...FORM_VACIO, rol: prev.rol })); }}
              >
                Por correo
              </button>
              <button
                type="button"
                className={modoBusqueda === "nombre" ? styles["modo-busqueda__activo"] : ""}
                onClick={() => { setModoBusqueda("nombre"); setForm((prev) => ({ ...FORM_VACIO, rol: prev.rol })); }}
              >
                Por nombre 
              </button>
            </div>
          )}

          {(!editando && modoBusqueda === "correo") ? (
            <label className="formulario__campo">
              <span className="formulario__etiqueta">Correo institucional</span>
              <input
                type="email"
                required
                placeholder="usuario@cobach.edu.mx"
                value={form.correo}
                onChange={fijarCampo("correo")}
              />
            </label>
          ) : (
            <div className="formulario__campo">
              <span className="formulario__etiqueta">Nombre completo</span>
              <BuscadorUsuarioInline
                value={form.nombre}
                required
                onChange={(texto) =>
                  setForm((prev) => ({ ...prev, nombre: texto, usuarioId: null }))
                }
                onSeleccionar={(u) =>
                  setForm((prev) => ({
                    ...prev,
                    nombre: u.nombre,
                    correo: u.correo,
                    usuarioId: u.id,
                  }))
                }
              />
            </div>
          )}

          {!editando && (
            <label className="formulario__campo">
              <span className="formulario__etiqueta">Tipo de acceso</span>
              <select value={form.rol} onChange={fijarCampo("rol")}>
                {Object.values(ROLES_GESTION).map((r) => (
                  <option key={r.id} value={r.id}>{r.etiqueta}</option>
                ))}
              </select>
            </label>
          )}

          {form.rol === "admin" && (
            <div className="formulario__campo">
              <span className="formulario__etiqueta">
                Plantel donde puede gestionar fechas
              </span>
              {form.planteles.length > 0 ? (
                <div className={styles["plantel-seleccionado"]}>
                  <MapPin size={13} />
                  <span>{form.planteles[0]}</span>
                  <button
                    type="button"
                    className={styles["plantel-seleccionado__quitar"]}
                    onClick={() => setForm((prev) => ({ ...prev, planteles: [] }))}
                    aria-label="Quitar plantel"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <>
                  <BuscadorPlantelInline
                    onSeleccionar={(p) => alternarPlantel(p.nombre)}
                    placeholder="Buscar plantel…"
                    autoFocus={false}
                  />
                  {plantelesDisponibles.length > 0 && (
                    <span className={styles["aviso-campo"]}>Selecciona un plantel.</span>
                  )}
                </>
              )}
            </div>
          )}

          {form.rol === "admin" && (
            <label className="formulario__campo">
              <span className="formulario__etiqueta">Turno</span>
              <select value={form.turno} onChange={fijarCampo("turno")}>
                {opcionesTurno.map((t) => (
                  <option key={t.id} value={t.id}>{t.etiqueta}</option>
                ))}
              </select>
            </label>
          )}

          {editando ? (
            <label className="formulario__campo">
              <span className="formulario__etiqueta">Rol</span>
              <select value={form.rol} onChange={fijarCampo("rol")}>
                {ROLES_EDICION.map((r) => (
                  <option key={r.id} value={r.id}>{r.etiqueta}</option>
                ))}
              </select>
              {form.rol === "docente" && (
                <span className={styles["aviso-campo"]}>
                  Al guardar, el usuario perderá su acceso de gestión. Su rol dependerá de sus credenciales institucionales.
                </span>
              )}
            </label>
          ) : null}

          {(ROLES_GESTION[form.rol] && (!editando || form.rol === "colaborador")) && (
            <p className={styles["rol-nota"]}>
              <ShieldCheck size={13} />
              <span>
                {editando
                  ? ROLES_GESTION[form.rol].descripcion
                  : <>Se registrará como <b>{ROLES_GESTION[form.rol].etiqueta}</b>. {ROLES_GESTION[form.rol].descripcion}</>}
              </span>
            </p>
          )}
        </form>
      </Modal>
    </section>
  );
}
