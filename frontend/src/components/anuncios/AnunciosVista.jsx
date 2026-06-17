import { useMemo } from "react";
import { Megaphone } from "lucide-react";
import { anunciosPara } from "../../lib/anunciosStore.js";
import ListaAnuncios from "./ListaAnuncios.jsx";
import styles from "./AnunciosVista.module.css";

// Módulo de anuncios SOLO LECTURA (docente / alumno). Muestra los anuncios
// dirigidos a su audiencia (y los de "todos"). Sin CRUD.
export default function AnunciosVista({ audiencia }) {
  const anuncios = useMemo(() => anunciosPara(audiencia), [audiencia]);

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
        <ListaAnuncios anuncios={anuncios} />
      </article>
    </section>
  );
}
