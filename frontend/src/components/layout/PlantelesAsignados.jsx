import styles from "./Layout.module.css";

// Sección "Planteles asignados" del panel de perfil del docente/administrativo,
// solo lectura: los cambios se piden desde el modal "Solicitar acceso" y los
// resuelven los administradores del plantel.
export default function PlantelesAsignados({ plantelesAgrupados }) {
  return (
    <div className={styles["menu-perfil__planteles"]}>
      <div className={styles["menu-perfil__planteles-header"]}>
        <span className={styles["menu-perfil__planteles-label"]}>Planteles asignados</span>
      </div>

      {plantelesAgrupados.length > 0
        ? plantelesAgrupados.map(({ plantel, turnos }) => (
          <div key={plantel.id} className={styles["menu-perfil__plantel-fila"]}>
            <span className={styles["menu-perfil__plantel-nombre"]} title={plantel.nombre}>{plantel.nombre}</span>
            <span className={styles["menu-perfil__turnos-badges"]}>
              {turnos.map(t => {
                const m = ['matutino','vespertino','mixto'].includes(t.nombre.toLowerCase()) ? t.nombre.toLowerCase() : 'otro';
                return <span key={t.id} className={`${styles['menu-perfil__turno-badge']} ${styles[`menu-perfil__turno-badge--${m}`]}`}>{t.nombre}</span>;
              })}
            </span>
          </div>
        ))
        : <p className={styles["menu-perfil__sin-planteles"]}>Sin planteles configurados</p>
      }
    </div>
  );
}
