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

  useEffect(() => {
    let vigente = true;
    listarAnuncios()
      .then((lista) => { if (vigente) setAnuncios(lista); })
      .catch(() => { if (vigente) setAnuncios([]); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, []);

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
        {cargando ? <p className={styles["vacio"]}>Cargando…</p> : <ListaAnunciosLectura anuncios={anuncios} />}
      </article>
    </section>
  );
}
