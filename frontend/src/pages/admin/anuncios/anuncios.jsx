import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import ListaAnuncios from "../../../components/anuncios/ListaAnuncios.jsx";
import ModalAnuncio from "../../../components/anuncios/ModalAnuncio.jsx";
import Cargando from "../../../components/Cargando.jsx";
import { AUDIENCIAS } from "../../../data/anuncios.js";
import {
  listarAnuncios,
  crearAnuncio,
  actualizarAnuncio,
  eliminarAnuncio,
} from "../../../services/anunciosService.js";
import { obtenerSesion } from "../../../services/authService.js";
import SelectorPlantel from "../../../components/selector-plantel/SelectorPlantel.jsx";
import { avisoExito, avisoError, confirmarAccion } from "../../../lib/alertas.js";
import { esAdmin as rolEsAdmin, esColaborador as rolEsColaborador, esGestorGlobal } from "../../../lib/permisos.js";
import styles from "./anuncios.module.css";

export default function Anuncios() {
  const sesion = obtenerSesion();
  const esAdmin = rolEsAdmin(sesion);
  const esColaborador = rolEsColaborador(sesion);
  const esGestor = esGestorGlobal(sesion);
  const esAgrupacionRol = sesion?.rol === 'director_departamento' || sesion?.rol === 'subdirector_departamento';
  const esDirectorDep = sesion?.rol === 'director_departamento';
  
  const audienciasVisibles = AUDIENCIAS.filter((a) => {
    if (a.id === "todos") return true;
    if (esAdmin) return a.id !== "colaborador";
    if (esColaborador) return a.id !== "docente" && a.id !== "admin";
    return true;
  });
  // Planteles asignados al admin (un admin no crea anuncios generales).
  const plantelesAdmin = esAgrupacionRol
    ? (sesion?.agrupacion?.planteles || [])
    : [...new Set((sesion?.planteles || []).map((p) => p.plantel?.nombre).filter(Boolean))];
  // Turnos asignados al admin (solo puede publicar en su turno)
  const turnosAdmin = [...new Set((sesion?.planteles || [])
    .map((p) => p.turno?.nombre)
    .filter(Boolean))];

  const [anuncios, setAnuncios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [filtro, setFiltro] = useState("todas");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  // Buscador del superusuario
  const [vistaPlantel, setVistaPlantel] = useState("");

  const recargar = () =>
    listarAnuncios({ plantelFiltro: vistaPlantel })
      .then((lista) => { setAnuncios(lista); setErrorCarga(false); })
      .catch(() => setErrorCarga(true))
      .finally(() => setCargando(false));

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setErrorCarga(false);
    listarAnuncios({ plantelFiltro: vistaPlantel })
      .then((lista) => { if (vigente) setAnuncios(lista); })
      .catch(() => { if (vigente) setErrorCarga(true); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [vistaPlantel]);

  const reintentar = () => {
    setCargando(true);
    setErrorCarga(false);
    recargar();
  };

  const filtrados =
    filtro === "todas" ? anuncios : anuncios.filter((a) => a.audiencia === filtro);

  const abrirNuevo = () => {
    setEditando(null);
    setModalAbierto(true);
  };

  const abrirEditar = (anuncio) => {
    setEditando(anuncio);
    setModalAbierto(true);
  };

  const guardar = async (datos) => {
    try {
      if (editando) {
        await actualizarAnuncio(editando.id, datos);
        avisoExito("Anuncio actualizado");
      } else if (datos.plantel === '__todos__') {
        await crearAnuncio({ ...datos, plantel: null });
        avisoExito("Anuncio publicado en todos los departamentos");
      } else {
        await crearAnuncio(datos);
        avisoExito("Anuncio publicado");
      }
      setModalAbierto(false);
      recargar();
    } catch (e) {
      avisoError(e.message);
    }
  };

  const eliminar = async (anuncio) => {
    const { isConfirmed } = await confirmarAccion({
      titulo: "Eliminar anuncio",
      html: `¿Seguro que deseas eliminar <b>${anuncio.titulo}</b>? Esta acción no se puede deshacer.`,
      confirmar: "Eliminar",
      peligro: true,
    });
    if (!isConfirmed) return;
    try {
      await eliminarAnuncio(anuncio.id);
      avisoExito("Anuncio eliminado");
      recargar();
    } catch (e) {
      avisoError(e.message);
    }
  };

  return (
    <section className={styles["pagina"]}>
      <header className={styles["encabezado"]}>
        <div>
          <h2 className={styles["encabezado__titulo"]}>Anuncios</h2>
          <p className={styles["encabezado__subtitulo"]}>
            {esAdmin
              ? "Publica comunicados para tu plantel dirigidos a administrativos, docentes o alumnos."
              : esAgrupacionRol
                ? "Publica comunicados para tus departamentos dirigidos a administrativos, docentes o alumnos."
                : "Publica comunicados para administrativos, docentes, alumnos o toda la comunidad."}
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
            {audienciasVisibles.filter((a) => a.id !== "todos").map((a) => (
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
          <div className={styles["barra__derecha"]}>
            {/* Buscador de gestión global (superusuario y colaborador) */}
            {esGestor && (
              <div className={styles["vista-plantel"]}>
                <span>Mostrar</span>
                <SelectorPlantel
                  value={vistaPlantel}
                  onChange={setVistaPlantel}
                  textoTodos="Solo generales"
                />
              </div>
            )}
            <span className={styles["conteo"]}>
              {filtrados.length} {filtrados.length === 1 ? "anuncio" : "anuncios"}
            </span>
          </div>
        </div>

        {cargando ? (
          <Cargando />
        ) : errorCarga ? (
          <div className={styles["vacio"]}>
            <p>No se pudieron cargar los anuncios.</p>
            <button
              type="button"
              className="boton boton--fantasma"
              style={{ marginTop: 10 }}
              onClick={reintentar}
            >
              Reintentar
            </button>
          </div>
        ) : (
          <ListaAnuncios
            anuncios={filtrados}
            onEditar={abrirEditar}
            onEliminar={eliminar}
            mostrarAudiencia
            animarEntrada
          />
        )}
      </article>

      {modalAbierto && (
        <ModalAnuncio
          anuncio={editando}
          esAdmin={esAdmin}
          esAgrupacionRol={esAgrupacionRol}
          esDirectorDep={esDirectorDep}
          audiencias={audienciasVisibles}
          plantelesAdmin={plantelesAdmin}
          turnosAdmin={turnosAdmin}
          onCerrar={() => setModalAbierto(false)}
          onGuardar={guardar}
        />
      )}
    </section>
  );
}
