import { useEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck, Send, Clock, MapPin, X, AlertTriangle } from "lucide-react";
import Modal from "../modal/Modal.jsx";
import { avisoExito, avisoError, avisoInfo } from "../../lib/alertas.js";
import { useSesion } from "../../hooks/useSesion.js";
import { useCampoFormulario } from "../../hooks/useCampoFormulario.js";
import { miSolicitudPendiente, enviarSolicitud } from "../../services/solicitudesService.js";
import BuscadorPlantelInline from "../buscador-plantel/BuscadorPlantelInline.jsx";
import styles from "./SolicitudAdmin.module.css";

// Turnos válidos: excluyentes entre sí (Mixto = cubre ambos)
const TURNOS = [
  { id: "matutino",   etiqueta: "Matutino" },
  { id: "vespertino", etiqueta: "Vespertino" },
  { id: "mixto",      etiqueta: "Mixto (ambos)" },
];
const TURNOS_MAP = Object.fromEntries(TURNOS.map((t) => [t.id, t.etiqueta]));

const TIPOS = [
  { id: "admin",         etiqueta: "Administrador" },
  { id: "visualizacion", etiqueta: "Visualizar plantel/departamento" },
  { id: "turno",         etiqueta: "Turno" },
];
const TIPOS_MAP = Object.fromEntries(TIPOS.map((t) => [t.id, t.etiqueta]));

const LIMITE_PLANTELES = 2;

// Nota informativa del formulario y texto de la tarjeta de pendiente, por tipo.
const NOTAS = {
  admin: (
    <>Tu solicitud será revisada por un <b>superusuario</b>. Si la aprueba, tu cuenta pasará de <b>Docente/Administrativo</b> a <b>Administrador</b> y podrás gestionar el calendario correspondiente.</>
  ),
  visualizacion: (
    <>Tu solicitud será revisada por un <b>administrador del plantel o departamento</b>. Si la aprueba, podrás visualizar el calendario de ese plantel (máximo {LIMITE_PLANTELES} planteles asignados).</>
  ),
  turno: (
    <>Tu solicitud será revisada por un <b>administrador del plantel</b>. Si la aprueba, tu turno en ese plantel se actualizará.</>
  ),
};

const PENDIENTE_TEXTO = {
  admin: (
    <>Un superusuario la revisará. Cuando la apruebe, tu cuenta pasará a <b>Administrador</b>.</>
  ),
  visualizacion: (
    <>Un administrador del plantel la revisará. Cuando la apruebe, podrás <b>visualizar ese plantel</b>.</>
  ),
  turno: (
    <>Un administrador del plantel la revisará. Cuando la apruebe, tu <b>turno se actualizará</b>.</>
  ),
};

const EXITO = {
  admin: "Solicitud de acceso de administrador enviada",
  visualizacion: "Solicitud para visualizar plantel enviada",
  turno: "Solicitud de cambio de turno enviada",
};

function formatoFecha(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(iso));
}

export default function SolicitudAdmin({ abierto, onCerrar }) {
  const { planteles = [] } = useSesion();

  // Planteles asignados únicos del usuario (con sus turnos actuales)
  const asignados = useMemo(() => {
    const porId = {};
    (planteles || []).forEach((up) => {
      const id = up?.plantel?.id;
      if (!id) return;
      if (!porId[id]) porId[id] = { id, nombre: up.plantel.nombre };
    });
    return Object.values(porId);
  }, [planteles]);

  const inicial = (tipo = "admin") => ({
    tipo,
    plantel: tipo === "turno" ? (asignados[0]?.nombre || "") : "",
    turno: "matutino",
    motivo: "",
  });

  const [form, setForm] = useState(() => inicial());
  const [pendiente, setPendiente] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);

  // Al abrir, reinicia el formulario.
  useEffect(() => {
    if (abierto) setForm(inicial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  // Al abrir o cambiar el tipo, verifica si ya hay una solicitud pendiente de ese tipo.
  useEffect(() => {
    if (!abierto) return undefined;
    let vigente = true;

    async function cargar() {
      setCargando(true);
      try {
        const s = await miSolicitudPendiente(form.tipo);
        if (vigente) setPendiente(s);
      } catch {
        if (vigente) setPendiente(null);
      } finally {
        if (vigente) setCargando(false);
      }
    }
    cargar();

    return () => { vigente = false; };
  }, [abierto, form.tipo]);

  const fijar = useCampoFormulario(setForm);

  const cambiarTipo = (e) => setForm(inicial(e.target.value));

  // Visualización: bloqueada si ya alcanzó el límite de planteles.
  const limiteAlcanzado = form.tipo === "visualizacion" && asignados.length >= LIMITE_PLANTELES;
  // Turno: requiere tener al menos un plantel asignado.
  const sinPlanteles = form.tipo === "turno" && asignados.length === 0;

  const puedeEnviar = !enviando && !cargando && !limiteAlcanzado && !sinPlanteles && !!form.plantel;

  const enviar = async (e) => {
    e.preventDefault();
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    try {
      // Nombre y correo no viajan: el backend los toma del usuario de la sesión.
      const res = await enviarSolicitud({
        tipo: form.tipo,
        plantel: form.plantel,
        turno: form.turno,
        motivo: form.motivo.trim(),
      });
      setPendiente(res.solicitud);
      if (res.ya_existe) {
        avisoInfo("Ya tienes una solicitud pendiente de este tipo");
      } else {
        avisoExito(EXITO[form.tipo] || "Solicitud enviada");
      }
    } catch (err) {
      avisoError(err.message || "No se pudo enviar la solicitud");
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  return (
    <Modal
      abierto={abierto}
      titulo="Solicitar acceso"
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
              form="form-solicitud-acceso"
              className="boton boton--primario"
              disabled={!puedeEnviar}
            >
              <Send size={16} />
              {enviando ? "Enviando…" : "Enviar solicitud"}
            </button>
          </>
        )
      }
    >
      <form id="form-solicitud-acceso" className="formulario" onSubmit={enviar}>
        <label className="formulario__campo">
          <span className="formulario__etiqueta">Tipo de solicitud</span>
          <select value={form.tipo} onChange={cambiarTipo}>
            {TIPOS.map((t) => (
              <option key={t.id} value={t.id}>{t.etiqueta}</option>
            ))}
          </select>
        </label>

        {cargando ? (
          <p className={styles["cargando"]}>Consultando tu solicitud…</p>
        ) : pendiente ? (
          // Ya tiene una solicitud pendiente de este tipo: se le muestra, no puede enviar otra.
          <div className={styles["pendiente"]}>
            <div className={styles["pendiente__cabecera"]}>
              <span className={styles["pendiente__icono"]}>
                <Clock size={18} />
              </span>
              <div>
                <h4 className={styles["pendiente__titulo"]}>Ya tienes una solicitud pendiente</h4>
                <p className={styles["pendiente__texto"]}>
                  {PENDIENTE_TEXTO[pendiente.tipo] || PENDIENTE_TEXTO.admin}
                </p>
              </div>
            </div>

            <ul className={styles["pendiente__datos"]}>
              <li>
                <span>Estado</span>
                <span className="etiqueta etiqueta--naranja">Pendiente</span>
              </li>
              <li>
                <span>Tipo</span>
                <strong>{TIPOS_MAP[pendiente.tipo] || pendiente.tipo}</strong>
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
        ) : limiteAlcanzado ? (
          <div className={`${styles["nota"]} ${styles["nota--alerta"]}`}>
            <AlertTriangle size={16} />
            <p>
              Ya tienes el límite de <b>{LIMITE_PLANTELES} planteles asignados</b>. No puedes solicitar la visualización de otro plantel.
            </p>
          </div>
        ) : sinPlanteles ? (
          <div className={`${styles["nota"]} ${styles["nota--alerta"]}`}>
            <AlertTriangle size={16} />
            <p>
              No tienes planteles asignados. Solicita primero la <b>visualización de un plantel</b> para poder pedir un cambio de turno.
            </p>
          </div>
        ) : (
          <>
            {form.tipo === "turno" ? (
              <label className="formulario__campo">
                <span className="formulario__etiqueta">Plantel asignado</span>
                <select value={form.plantel} onChange={fijar("plantel")}>
                  {asignados.map((p) => (
                    <option key={p.id} value={p.nombre}>{p.nombre}</option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="formulario__campo">
                <span className="formulario__etiqueta">Plantel o departamento</span>
                {form.plantel ? (
                  <div className={styles["plantel-seleccionado"]}>
                    <MapPin size={13} />
                    <span>{form.plantel}</span>
                    <button
                      type="button"
                      className={styles["plantel-seleccionado__quitar"]}
                      onClick={() => setForm((prev) => ({ ...prev, plantel: "" }))}
                      aria-label="Quitar plantel"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <BuscadorPlantelInline
                    excluirIds={form.tipo === "visualizacion" ? asignados.map((p) => p.id) : []}
                    onSeleccionar={(p) => setForm((prev) => ({ ...prev, plantel: p.nombre }))}
                    placeholder="Buscar plantel por nombre o número…"
                    autoFocus={false}
                  />
                )}
              </div>
            )}

            <label className="formulario__campo">
              <span className="formulario__etiqueta">
                {form.tipo === "turno" ? "Nuevo turno" : "Turno"}
              </span>
              <select value={form.turno} onChange={fijar("turno")}>
                {TURNOS.map((t) => (
                  <option key={t.id} value={t.id}>{t.etiqueta}</option>
                ))}
              </select>
            </label>

            <label className="formulario__campo">
              <span className="formulario__etiqueta">Motivo (opcional)</span>
              <textarea
                rows={3}
                className={styles["motivo"]}
                placeholder={
                  form.tipo === "admin"
                    ? "¿Por qué necesitas gestionar el calendario?"
                    : form.tipo === "visualizacion"
                    ? "¿Por qué necesitas visualizar este plantel?"
                    : "¿Por qué necesitas cambiar de turno?"
                }
                value={form.motivo}
                onChange={fijar("motivo")}
              />
            </label>

            <div className={styles["nota"]}>
              <ShieldCheck size={16} />
              <p>{NOTAS[form.tipo]}</p>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
