import { useEffect, useState } from "react";
import { ShieldCheck, Send, Clock, MapPin } from "lucide-react";
import Modal from "../modal/Modal.jsx";
import { avisoExito, avisoError, avisoInfo } from "../../lib/alertas.js";
import { useSesion } from "../../hooks/useSesion.js";
import { PLANTELES, TURNOS } from "../../data/usuarios.js";
import { miSolicitudPendiente, enviarSolicitud } from "../../services/solicitudesService.js";
import styles from "./SolicitudAdmin.module.css";

const TURNOS_MAP = Object.fromEntries(TURNOS.map((t) => [t.id, t.etiqueta]));

function formatoFecha(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(iso));
}

export default function SolicitudAdmin({ abierto, onCerrar }) {
  const { nombre } = useSesion();

  const inicial = () => ({
    nombre: nombre || "",
    correo: "",
    plantel: PLANTELES[0],
    turno: "matutino",
    motivo: "",
  });

  const [form, setForm] = useState(inicial);
  const [pendiente, setPendiente] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Al abrir, se consulta si ya hay una solicitud pendiente.
  useEffect(() => {
    if (!abierto) return undefined;
    let vigente = true;

    async function cargar() {
      setForm(inicial());
      setCargando(true);
      try {
        const s = await miSolicitudPendiente();
        if (vigente) setPendiente(s);
      } catch {
        if (vigente) setPendiente(null);
      } finally {
        if (vigente) setCargando(false);
      }
    }
    cargar();

    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const fijar = (campo) => (e) =>
    setForm((prev) => ({ ...prev, [campo]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      const res = await enviarSolicitud({
        nombre: form.nombre.trim(),
        correo: form.correo.trim(),
        plantel: form.plantel,
        turno: form.turno,
        motivo: form.motivo.trim(),
      });
      setPendiente(res.solicitud);
      if (res.ya_existe) {
        avisoInfo("Ya tienes una solicitud pendiente");
      } else {
        avisoExito("Solicitud enviada");
      }
    } catch (err) {
      avisoError(err.message || "No se pudo enviar la solicitud");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      abierto={abierto}
      titulo="Solicitar acceso de administrador"
      onCerrar={onCerrar}
      pie={
        pendiente ? (
          <button type="button" className="boton boton--primario" onClick={onCerrar}>
            Entendido
          </button>
        ) : (
          <>
            <button type="button" className="boton boton--fantasma" onClick={onCerrar}>
              Cancelar
            </button>
            <button
              type="submit"
              form="form-solicitud-admin"
              className="boton boton--primario"
              disabled={enviando || cargando}
            >
              <Send size={16} />
              {enviando ? "Enviando…" : "Enviar solicitud"}
            </button>
          </>
        )
      }
    >
      {cargando ? (
        <p className={styles["cargando"]}>Consultando tu solicitud…</p>
      ) : pendiente ? (
        // Ya tiene una solicitud pendiente: se le muestra, no puede enviar otra.
        <div className={styles["pendiente"]}>
          <div className={styles["pendiente__cabecera"]}>
            <span className={styles["pendiente__icono"]}>
              <Clock size={18} />
            </span>
            <div>
              <h4 className={styles["pendiente__titulo"]}>Ya tienes una solicitud pendiente</h4>
              <p className={styles["pendiente__texto"]}>
                Un superusuario la revisará. Cuando la apruebe, tu cuenta pasará a
                <b> Administrador</b>.
              </p>
            </div>
          </div>

          <ul className={styles["pendiente__datos"]}>
            <li>
              <span>Estado</span>
              <span className="etiqueta etiqueta--naranja">Pendiente</span>
            </li>
            <li>
              <span>Plantel</span>
              <strong><MapPin size={12} /> {pendiente.plantel || "—"}</strong>
            </li>
            <li>
              <span>Turno</span>
              <strong>{TURNOS_MAP[pendiente.turno] || pendiente.turno || "—"}</strong>
            </li>
            <li>
              <span>Enviada</span>
              <strong>{formatoFecha(pendiente.fecha_solicitud)}</strong>
            </li>
            {pendiente.motivo && (
              <li className={styles["pendiente__motivo"]}>
                <span>Motivo</span>
                <p>{pendiente.motivo}</p>
              </li>
            )}
          </ul>
        </div>
      ) : (
        <>
          <div className={styles["nota"]}>
            <ShieldCheck size={16} />
            <p>
              Tu solicitud será revisada por un superusuario. Si la aprueba, tu cuenta
              pasará de <b>Docente</b> a <b>Administrador</b> y podrás gestionar el
              calendario del plantel indicado.
            </p>
          </div>

          <form id="form-solicitud-admin" className="formulario" onSubmit={enviar}>
            <label className="formulario__campo">
              <span className="formulario__etiqueta">Nombre completo</span>
              <input
                type="text"
                required
                placeholder="Tu nombre completo"
                value={form.nombre}
                onChange={fijar("nombre")}
              />
            </label>

            <label className="formulario__campo">
              <span className="formulario__etiqueta">Correo institucional</span>
              <input
                type="email"
                required
                placeholder="usuario@cobach.edu.mx"
                value={form.correo}
                onChange={fijar("correo")}
              />
            </label>

            <div className="formulario__fila">
              <label className="formulario__campo">
                <span className="formulario__etiqueta">Plantel</span>
                <select value={form.plantel} onChange={fijar("plantel")}>
                  {PLANTELES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="formulario__campo">
                <span className="formulario__etiqueta">Turno</span>
                <select value={form.turno} onChange={fijar("turno")}>
                  {TURNOS.map((t) => (
                    <option key={t.id} value={t.id}>{t.etiqueta}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="formulario__campo">
              <span className="formulario__etiqueta">Motivo (opcional)</span>
              <textarea
                rows={3}
                placeholder="¿Por qué necesitas gestionar el calendario?"
                value={form.motivo}
                onChange={fijar("motivo")}
              />
            </label>
          </form>
        </>
      )}
    </Modal>
  );
}
