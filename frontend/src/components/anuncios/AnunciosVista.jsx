import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { listarAnuncios } from "../../services/anunciosService.js";
import ListaAnunciosLectura from "./ListaAnunciosLectura.jsx";
import styles from "./AnunciosVista.module.css";

// Módulo de anuncios SOLO LECTURA (docente / alumno). 
// Se filtran los anuncios dirigidos a su rol y plantel (más los de "todos"). Sin CRUD.
export default function AnunciosVista() {
  const [anuncios, setAnuncios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [reintento, setReintento] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setErrorCarga(false);
    listarAnuncios()
      .then((lista) => { if (vigente) setAnuncios(lista); })
      .catch(() => { if (vigente) setErrorCarga(true); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [reintento]);

  return (
    <section className={styles["pagina"]}>
      <header className={styles["encabezado"]}>
        <h2 className={styles["encabezado__titulo"]}>
          <Megaphone size={20} />
          Anuncios
        </h2>
        <p className={styles["encabezado__subtitulo"]}>
          Comunicados y avisos de la institución.
        </p>
      </header>

      <article className="tarjeta">
        {cargando ? (
          <p className={styles["vacio"]}>Cargando…</p>
        ) : errorCarga ? (
          <div className={styles["vacio"]}>
            <p>No se pudieron cargar los anuncios.</p>
            <button
              type="button"
              className="boton boton--fantasma"
              style={{ marginTop: 10 }}
              onClick={() => setReintento((n) => n + 1)}
            >
              Reintentar
            </button>
          </div>
        ) : (
          <ListaAnunciosLectura anuncios={anuncios} />
        )}
      </article>
    </section>
  );
}
