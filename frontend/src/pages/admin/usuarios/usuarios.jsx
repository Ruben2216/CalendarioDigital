import { useEffect, useMemo, useState } from "react";
import {
  Users, UserCheck, Clock, Search, Plus, Check, X, Pencil, Trash2,
  MapPin, ShieldCheck, Mail,
} from "lucide-react";
import Modal from "../../../components/modal/Modal.jsx";
import { avisoExito, avisoError, confirmarAccion, confirmarEliminacion } from "../../../lib/alertas.js";
import { ROL, ESTADOS, TURNOS } from "../../../data/usuarios.js";
import { listarSolicitudes, resolverSolicitud } from "../../../services/solicitudesService.js";
import { obtenerPlanteles } from "../../../services/authService.js";
import BuscadorPlantelInline from "../../../components/buscador-plantel/BuscadorPlantelInline.jsx";
import styles from "./usuarios.module.css";

const ESTADOS_MAP = Object.fromEntries(ESTADOS.map((e) => [e.id, e]));
const TURNOS_MAP = Object.fromEntries(TURNOS.map((t) => [t.id, t]));

// Estado del backend (pendiente/aceptada/rechazada) → estado de esta pantalla.
const ESTADO_BACKEND = { pendiente: "pendiente", aceptada: "activo", rechazada: "rechazado" };

function solicitudAFila(s) {
  return {
    id: `sol-${s.id}`,
    solicitudId: s.id,
    origenBackend: true,
    nombre: s.nombre,
    correo: s.correo,
    turno: s.turno || "matutino",
    planteles: s.plantel ? [s.plantel] : [],
    estado: ESTADO_BACKEND[s.estado] || "pendiente",
    solicitado: (s.fecha_solicitud || "").slice(0, 10),
  };
}

const FORM_VACIO = { nombre: "", correo: "", turno: "matutino", planteles: [], estado: "pendiente" };

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
  const [plantelesDisponibles, setPlantelesDisponibles] = useState([]); // { id, nombre }[]

  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [editando, setEditando] = useState(null);

  // Carga solicitudes y planteles en paralelo al montar el componente.
  useEffect(() => {
    let vigente = true;
    Promise.all([listarSolicitudes(), obtenerPlanteles()])
      .then(([lista, planteles]) => {
        if (!vigente) return;
        setUsuarios(lista.map(solicitudAFila));
        setPlantelesDisponibles(planteles);
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

  // CRUD
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
      estado: usuario.estado,
    });
    setModalAbierto(true);
  };

  const fijarCampo = (campo) => (e) =>
    setForm((prev) => ({ ...prev, [campo]: e.target.value }));

  const alternarPlantel = (plantel) =>
    setForm((prev) => ({
      ...prev,
      planteles: prev.planteles.includes(plantel)
        ? prev.planteles.filter((p) => p !== plantel)
        : [...prev.planteles, plantel],
    }));

  const guardar = (e) => {
    e.preventDefault();
    if (form.planteles.length === 0) return;
    const datos = {
      ...form,
      nombre: form.nombre.trim(),
      correo: form.correo.trim(),
    };
    if (editando) {
      setUsuarios((prev) => prev.map((u) => (u.id === editando ? { ...u, ...datos } : u)));
    } else {
      setUsuarios((prev) => [
        ...prev,
        { ...datos, id: Date.now(), solicitado: new Date().toISOString().slice(0, 10) },
      ]);
    }
    setModalAbierto(false);
    avisoExito(editando ? "Usuario actualizado" : "Usuario agregado");
  };

  // Aceptar / Rechazar / Eliminar 
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

  return (
    <section className={styles["pagina"]}>
      {/* Encabezado */}
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

      {/* Indicadores */}
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

      {/* Tarjeta con buscador + filtros + lista */}
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
                  <th>Planteles asignados</th>
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
                      <td>
                        <div className={styles["planteles"]}>
                          {u.planteles.map((p) => (
                            <span key={p} className={styles["plantel-chip"]}>
                              <MapPin size={11} />
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className={`etiqueta etiqueta--${turno?.color}`}>{turno?.etiqueta}</span>
                      </td>
                      <td>
                        <span className={`etiqueta etiqueta--${ROL.color}`}>{ROL.etiqueta}</span>
                      </td>
                      <td>
                        <span className={`etiqueta etiqueta--${estado?.color}`}>{estado?.etiqueta}</span>
                      </td>
                      <td className={styles["tabla__tenue"]}>{formatoFecha(u.solicitado)}</td>
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
          <label className="formulario__campo">
            <span className="formulario__etiqueta">Nombre completo</span>
            <input type="text" required placeholder="Nombre del administrador" value={form.nombre} onChange={fijarCampo("nombre")} />
          </label>

          <label className="formulario__campo">
            <span className="formulario__etiqueta">Correo institucional</span>
            <input type="email" required placeholder="usuario@cobach.edu.mx" value={form.correo} onChange={fijarCampo("correo")} />
          </label>

          <div className="formulario__fila">
            <label className="formulario__campo">
              <span className="formulario__etiqueta">Turno</span>
              <select value={form.turno} onChange={fijarCampo("turno")}>
                {TURNOS.map((t) => (
                  <option key={t.id} value={t.id}>{t.etiqueta}</option>
                ))}
              </select>
            </label>
            <label className="formulario__campo">
              <span className="formulario__etiqueta">Estado</span>
              <select value={form.estado} onChange={fijarCampo("estado")}>
                {ESTADOS.map((e) => (
                  <option key={e.id} value={e.id}>{e.etiqueta}</option>
                ))}
              </select>
            </label>
          </div>

          <p className={styles["rol-nota"]}>
            <ShieldCheck size={13} />
            <span>Se registrará como <b>{ROL.etiqueta}</b>. {ROL.descripcion}</span>
          </p>

          <div className="formulario__campo">
            <span className="formulario__etiqueta">
              Planteles donde puede gestionar fechas
            </span>
            <BuscadorPlantelInline
              excluirIds={plantelesDisponibles.filter(p => form.planteles.includes(p.nombre)).map(p => p.id)}
              onSeleccionar={(p) => { if (!form.planteles.includes(p.nombre)) alternarPlantel(p.nombre); }}
              placeholder="Buscar y agregar plantel…"
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
              <span className={styles["aviso-campo"]}>Selecciona al menos un plantel.</span>
            )}
          </div>
        </form>
      </Modal>
    </section>
  );
}
{/*La logica de negocio es la siguiente:
    El docente solicita el rol de administrador a traves de su formulario ya definido en su panel
    El superusuario recibe la solicitud y puede aprobarla o rechazarla desde el panel de administración
    El superusuario unicamente puede asignar un plantel en caso de que el superusuario lo haga manualmente la asinacion pero esto sera a futuro
    El docente solicita acceso a un plantel y el superusuario lo aprueba o no, este debera mostrarse en el panel de usuarios del superadmin
    El superusuario podra asignar unicamente un turno, el turno deberas reutilizarlo cuando se obtiene de la entidad Turno de la BD, son 3, Matutino, Vespertino y Mixto, el turno se asigna a nivel de usuario, no por plantel, es decir, un usuario no puede tener asignado matutino para un plantel y vespertino para otro, esto ya esta definido en la mayoria
    Desaparece del modal 'Modal: crear / editar ' la opcion de Estado ya que si se supone que el superadmin esta dando de alta a un nuevo admin es porque no tendra un estado de pendiente o rechazado y sera automaticamente en Activo
    Todo ese flujo debera ser reflejado en la BD, es decir por ejemplo si el admin acepta la solicitud entonces x usuario cambiara su rol.


  */}