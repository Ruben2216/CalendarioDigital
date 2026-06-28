import { useState } from "react";
import { Megaphone } from "lucide-react";
import Modal from "../modal/Modal.jsx";
import { AUDIENCIAS, COLORES_ANUNCIO } from "../../data/anuncios.js";
import SelectorPlantel from "../selector-plantel/SelectorPlantel.jsx";
import styles from "./ModalAnuncio.module.css";

const TURNOS_DISPONIBLES = ["Matutino", "Vespertino", "Mixto"];

export default function ModalAnuncio({ anuncio, esAdmin = false, plantelesAdmin = [], turnosAdmin = [], onCerrar, onGuardar }) {
  const [form, setForm] = useState(() =>
    anuncio
      ? {
          titulo: anuncio.titulo,
          descripcion: anuncio.descripcion,
          audiencia: anuncio.audiencia,
          plantel: anuncio.plantel || "",
          turno: anuncio.turno || "",
          color: anuncio.color,
        }
      : {
          titulo: "",
          descripcion: "",
          audiencia: "todos",
          plantel: esAdmin ? plantelesAdmin[0] || "" : "",
          turno: esAdmin ? turnosAdmin[0] || "" : "",
          color: "azul",
        }
  );

  const [enviando, setEnviando] = useState(false);

  const fijar = (campo) => (e) => setForm((prev) => ({ ...prev, [campo]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    try {
      await onGuardar({
        ...form,
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim(),
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      abierto
      titulo={anuncio ? "Editar anuncio" : "Nuevo anuncio"}
      onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="boton boton--fantasma" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" form="form-anuncio" className="boton boton--primario" disabled={enviando}>
            {enviando
              ? "Guardando…"
              : anuncio ? "Guardar cambios" : "Publicar"}
          </button>
        </>
      }
    >
      <form id="form-anuncio" className="formulario" onSubmit={enviar}>
        <label className="formulario__campo">
          <span className="formulario__etiqueta">Título</span>
          <input
            type="text"
            required
            placeholder="Título del anuncio"
            value={form.titulo}
            onChange={fijar("titulo")}
          />
        </label>

        <label className="formulario__campo">
          <span className="formulario__etiqueta">Descripción</span>
          <textarea
            rows={3}
            required
            placeholder="Detalle del anuncio…"
            value={form.descripcion}
            onChange={fijar("descripcion")}
          />
        </label>

        <div className="formulario__fila">
          <label className="formulario__campo">
            <span className="formulario__etiqueta">Dirigido a</span>
            <select value={form.audiencia} onChange={fijar("audiencia")}>
              {AUDIENCIAS.map((a) => (
                <option key={a.id} value={a.id}>{a.etiqueta}</option>
              ))}
            </select>
          </label>
          <label className="formulario__campo">
            <span className="formulario__etiqueta">Color</span>
            <select value={form.color} onChange={fijar("color")}>
              {COLORES_ANUNCIO.map((c) => (
                <option key={c.valor} value={c.valor}>{c.etiqueta}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="formulario__campo">
          <span className="formulario__etiqueta">Alcance</span>
          {esAdmin ? (
            plantelesAdmin.length > 1 ? (
              <select value={form.plantel} onChange={fijar("plantel")} required>
                {plantelesAdmin.map((nombre) => (
                  <option key={nombre} value={nombre}>{nombre}</option>
                ))}
              </select>
            ) : (
              <input type="text" value={form.plantel} disabled readOnly />
            )
          ) : (
            <SelectorPlantel
              value={form.plantel}
              onChange={(v) => setForm((prev) => ({ ...prev, plantel: v }))}
              textoTodos="General (todos los planteles)"
            />
          )}
        </label>

        <label className="formulario__campo">
          <span className="formulario__etiqueta">Turno</span>
          {esAdmin ? (
            turnosAdmin.length > 1 ? (
              <select value={form.turno} onChange={fijar("turno")} required>
                {turnosAdmin.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            ) : (
              <input type="text" value={form.turno || "—"} disabled readOnly />
            )
          ) : (
            <select value={form.turno} onChange={fijar("turno")}>
              <option value="">Todos los turnos</option>
              {TURNOS_DISPONIBLES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
        </label>

        <div className={styles["previa"]}>
          <span className="formulario__etiqueta">Vista previa</span>
          <div className={styles["previa__fila"]}>
            <span className={`${styles["previa__icono"]} ${styles[`previa__icono--${form.color}`]}`}>
              <Megaphone size={14} />
            </span>
            <div>
              <p className={styles["previa__titulo"]}>{form.titulo.trim() || "Título del anuncio"}</p>
              <p className={styles["previa__desc"]}>{form.descripcion.trim() || "Descripción…"}</p>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
