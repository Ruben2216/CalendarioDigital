import { lazy, Suspense } from "react";
import styles from "./alumno.module.css";

// Reutiliza el mismo calendario del panel en modo solo lectura
const Calendario = lazy(() => import("../admin/calendario/calendario.jsx"));

export default function Alumno() {
  return (
    <div className={styles["alumno"]}>
      <Suspense
        fallback={
          <div className={styles["alumno__cargando"]}>Cargando calendario…</div>
        }
      >
        <Calendario soloLectura />
      </Suspense>
    </div>
  );
}
