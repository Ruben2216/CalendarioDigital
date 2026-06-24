import { useEffect, useMemo, useState } from "react";
import {
  Users, UserCheck, Clock, Search, Plus, Check, X, Pencil, Trash2,
  MapPin, ShieldCheck, Mail,
} from "lucide-react";
import Modal from "../../../components/modal/Modal.jsx";
import { avisoExito, avisoError, confirmarAccion, confirmarEliminacion } from "../../../lib/alertas.js";
import { ROL, ESTADOS, TURNOS } from "../../../data/usuarios.js";
import { listarSolicitudes, listarAdministradores, resolverSolicitud, crearAdmin, actualizarAdmin } from "../../../services/solicitudesService.js";
import { obtenerPlanteles, obtenerTurnos } from "../../../services/authService.js";
import BuscadorPlantelInline from "../../../components/buscador-plantel/BuscadorPlantelInline.jsx";
import BuscadorUsuarioInline from "../../../components/buscador-usuario/BuscadorUsuarioInline.jsx";
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
    turno: s.turno || "matutino",
    planteles: s.plantel ? [s.plantel] : [],
    estado: ESTADO_BACKEND[s.estado] || "pendiente",
    solicitado: (s.fecha_solicitud || "").slice(0, 10),
  };
}

function adminAFila(u) {
  const primera = u.planteles?.[0];
  return {
    id: `adm-${u.id}`,
    id_usuario: u.id,
    origenBackend: false,
    nombre: u.nombre,
    correo: u.correo,
    turno: (primera?.turno || "matutino").toLowerCase(),
    planteles: (u.planteles || []).map((p) => p.plantel).filter(Boolean),
    estado: "activo",
    solicitado: "",
  };
}

const FORM_VACIO = { nombre: "", correo: "", turno: "matutino", planteles: [], usuarioId: null };

function iniciales(nombre) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function formatoFecha(clave) {
  if (!clave) return "—";
  const [a, m, d] = clave.split("-").map(Number);
  const fecha = new Date(a, m - 1, d);
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(fecha);
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [plantelesDisponibles, setPlantelesDisponibles] = useState([]);
  const [turnosDisponibles, setTurnosDisponibles] = useState([]);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [editando, setEditando] = useState(null);

  useEffect(() => {
    let vigente = true;
    Promise.all([listarSolicitudes(), listarAdministradores(), obtenerPlanteles(), obtenerTurnos()])
      .then(([solicitudes, admins, planteles, turnos]) => {
        if (!vigente) return;
        // Los admins activos (creados directo o por solicitud aceptada) vienen de
        // /api/usuarios?rol=admin. Las solicitudes aceptadas ya son admins, así que
        // de las solicitudes solo se conservan las pendientes/rechazadas (sin duplicar).
        const correosAdmin = new Set(admins.map((a) => a.correo));
        const filasSolicitudes = solicitudes
          .filter((s) => !correosAdmin.has(s.correo))
          .map(solicitudAFila);
        setUsuarios([...filasSolicitudes, ...admins.map(adminAFila)]);
        setPlantelesDisponibles(planteles);
        setTurnosDisponibles(turnos);
      })
      .catch(() => { /* backend no disponible */ })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, []);

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
    setModalAbierto(true);
  };

  const abrirEditar = (usuario) => {
    setEditando(usuario.id);
    setForm({
      nombre: usuario.nombre,
      correo: usuario.correo,
      turno: usuario.turno,
      planteles: [...usuario.planteles],
      usuarioId: usuario.id_usuario ?? null,
    });
    setModalAbierto(true);
  };

  const fijarCampo = (campo) => (e) =>
    setForm((prev) => ({ ...prev, [campo]: e.target.value }));

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
    if (form.planteles.length === 0) return;

    const nombre = form.nombre.trim();
    const correo = form.correo.trim();
    const plantelId = _plantelIdDesdeForm();
    const turnoId = _turnoIdDesdeForm();

    if (editando) {
      const usuarioEditando = usuarios.find((u) => u.id === editando);
      if (usuarioEditando?.id_usuario && plantelId && turnoId) {
        try {
          await actualizarAdmin(usuarioEditando.id_usuario, {
            nombre,
            plantel_id: plantelId,
            turno_id: turnoId,
          });
        } catch (err) {
          avisoError(err.message || "No se pudo actualizar el usuario");
          return;
        }
      }
      setUsuarios((prev) =>
        prev.map((u) =>
          u.id === editando
            ? { ...u, nombre, turno: form.turno, planteles: [...form.planteles] }
            : u,
        ),
      );
    } else {
      if (!plantelId || !turnoId) {
        avisoError("Plantel o turno no válido. Verifica la conexión con el servidor.");
        return;
      }
      let res;
      try {
        res = await crearAdmin({ nombre, correo, plantel_id: plantelId, turno_id: turnoId });
      } catch (err) {
        avisoError(err.message || "No se pudo crear el administrador");
        return;
      }
      setUsuarios((prev) => [
        ...prev,
        {
          id: res.id_usuario,
          id_usuario: res.id_usuario,
          nombre: res.nombre,
          correo: res.correo,
          turno: res.turno,
          planteles: [res.plantel],
          estado: "activo",
          solicitado: new Date().toISOString().slice(0, 10),
          origenBackend: false,
        },
      ]);
    }

    setModalAbierto(false);
    avisoExito(editando ? "Usuario actualizado" : "Administrador agregado");
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
    setUsuarios((prev) => prev.filter((u) => u.id !== usuario.id));
    avisoExito("Usuario eliminado");
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
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className={styles["usuario"]}>
                          <span className={`${styles["usuario__avatar"]} ${styles[`usuario__avatar--${ROL.color}`]}`}>
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
                        <div className={styles["planteles"]}>
                          {u.planteles.map((p) => (
                            <span key={p} className={styles["plantel-chip"]}>
                              <MapPin size={11} />
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td data-label="Turno">
                        <span className={`etiqueta etiqueta--${turno?.color}`}>{turno?.etiqueta}</span>
                      </td>
                      <td data-label="Rol">
                        <span className={`etiqueta etiqueta--${ROL.color}`}>{ROL.etiqueta}</span>
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
                          {u.estado !== "rechazado" && (
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
                          <button
                            type="button"
                            className={styles["acciones__borrar"]}
                            onClick={() => eliminar(u)}
                            aria-label="Eliminar"
                            title="Eliminar"
                          >
                            <Trash2 size={15} />
                          </button>
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

          <label className="formulario__campo">
            <span className="formulario__etiqueta">Correo institucional</span>
            <input type="email" required placeholder="usuario@cobach.edu.mx" value={form.correo} onChange={fijarCampo("correo")} />
          </label>

          <label className="formulario__campo">
            <span className="formulario__etiqueta">Turno</span>
            <select value={form.turno} onChange={fijarCampo("turno")}>
              {opcionesTurno.map((t) => (
                <option key={t.id} value={t.id}>{t.etiqueta}</option>
              ))}
            </select>
          </label>

          <p className={styles["rol-nota"]}>
            <ShieldCheck size={13} />
            <span>Se registrará como <b>{ROL.etiqueta}</b>. {ROL.descripcion}</span>
          </p>

          <div className="formulario__campo">
            <span className="formulario__etiqueta">
              Plantel donde puede gestionar fechas
            </span>
            <BuscadorPlantelInline
              excluirIds={plantelesDisponibles.filter(p => form.planteles.includes(p.nombre)).map(p => p.id)}
              onSeleccionar={(p) => { if (!form.planteles.includes(p.nombre)) alternarPlantel(p.nombre); }}
              placeholder="Buscar plantel…"
            />
            <ul className={styles["planteles-check"]}>
              {plantelesDisponibles.map((p) => (
                <li key={p.id}>
                  <label className={styles["check"]}>
                    <input
                      type="checkbox"
                      checked={form.planteles.includes(p.nombre)}
                      onChange={() => alternarPlantel(p.nombre)}
                    />
                    <span className={styles["check__texto"]}>{p.nombre}</span>
                  </label>
                </li>
              ))}
              {plantelesDisponibles.length === 0 && (
                <li className={styles["aviso-campo"]}>Cargando planteles…</li>
              )}
            </ul>
            {form.planteles.length === 0 && plantelesDisponibles.length > 0 && (
              <span className={styles["aviso-campo"]}>Selecciona un plantel.</span>
            )}
          </div>
        </form>
      </Modal>
    </section>
  );
}
