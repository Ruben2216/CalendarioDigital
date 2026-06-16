import { useState } from "react";
import { Plus } from "lucide-react";
import ListaAnuncios from "../../../components/anuncios/ListaAnuncios.jsx";
import ModalAnuncio from "../../../components/anuncios/ModalAnuncio.jsx";
import { AUDIENCIAS } from "../../../data/anuncios.js";
import { leerAnuncios, crearAnuncio, actualizarAnuncio, eliminarAnuncio } from "../../../lib/anunciosStore.js";
import { avisoExito, confirmarAccion } from "../../../lib/alertas.js";
import styles from "./anuncios.module.css";

export default function Anuncios() {
  const [anuncios, setAnuncios] = useState(() => leerAnuncios());
  const [filtro, setFiltro] = useState("todas");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);

  const filtrados = filtro === "todas"
    ? anuncios
    : anuncios.filter((a) => a.audiencia === filtro);

  const abrirNuevo = () => {
    setEditando(null);
    setModalAbierto(true);
  };

  const abrirEditar = (anuncio) => {
    setEditando(anuncio);
    setModalAbierto(true);
  };

  const guardar = (datos) => {
    if (editando) {
      setAnuncios(actualizarAnuncio(editando.id, datos));
      avisoExito("Anuncio actualizado");
    } else {
      setAnuncios(crearAnuncio(datos));
      avisoExito("Anuncio publicado");
    }
    setModalAbierto(false);
  };

  const eliminar = async (anuncio) => {
    const { isConfirmed } = await confirmarAccion({
      titulo: "Eliminar anuncio",
      html: `¿Seguro que deseas eliminar <b>${anuncio.titulo}</b>? Esta acción no se puede deshacer.`,
      confirmar: "Eliminar",
      peligro: true,
    });
    if (!isConfirmed) return;
    setAnuncios(eliminarAnuncio(anuncio.id));
    avisoExito("Anuncio eliminado");
  };

  return (
    <section className={styles["pagina"]}>
      <header className={styles["encabezado"]}>
        <div>
          <h2 className={styles["encabezado__titulo"]}>Anuncios</h2>
          <p className={styles["encabezado__subtitulo"]}>
            Publica comunicados para administrativos, docentes, alumnos o toda la comunidad.
          </p>
        </div>
        <button type="button" className="boton boton--primario" onClick={abrirNuevo}>
          <Plus size={16} />
          Nuevo anuncio
        </button>
      </header>

      <article className="tarjeta">
        <div className={styles["barra"]}>
          <div className={styles["filtros"]}>
            <button
              type="button"
              className={`${styles["chip"]} ${filtro === "todas" ? styles["chip--activo"] : ""}`}
              onClick={() => setFiltro("todas")}
            >
              Todos
            </button>
            {AUDIENCIAS.filter((a) => a.id !== "todos").map((a) => (
              <button
                key={a.id}
                type="button"
                className={`${styles["chip"]} ${filtro === a.id ? styles["chip--activo"] : ""}`}
                onClick={() => setFiltro(a.id)}
              >
                {a.etiqueta}
              </button>
            ))}
          </div>
          <span className={styles["conteo"]}>
            {filtrados.length} {filtrados.length === 1 ? "anuncio" : "anuncios"}
          </span>
        </div>

        <ListaAnuncios
          anuncios={filtrados}
          onEditar={abrirEditar}
          onEliminar={eliminar}
          mostrarAudiencia
        />
      </article>

      {modalAbierto && (
        <ModalAnuncio
          anuncio={editando}
          onCerrar={() => setModalAbierto(false)}
          onGuardar={guardar}
        />
      )}
    </section>
  );
}
