import { Bell, CheckCheck, Trash2 } from "lucide-react";
import NotificacionFila from "../notificaciones/NotificacionFila.jsx";
import styles from "./Layout.module.css";

// Campana + panel de notificaciones. Compartido por todos los layouts.
// El estado de apertura y la ref viven en LayoutBase (para el cierre por click-fuera).
export default function NotificacionesPanel({
  notifRef,
  abierto,
  onToggle,
  onCerrar,
  notificaciones,
  notifSinLeer,
  marcarTodasLeidas,
  marcarLeida,
  limpiarNotificaciones,
}) {
  return (
    <div className={styles["notificaciones"]} ref={notifRef}>
      <button
        type="button"
        className={styles["notificaciones__boton"]}
        onClick={onToggle}
        aria-label="Notificaciones"
      >
        <Bell size={20} />
        {notifSinLeer > 0 && (
          <span className={styles["notificaciones__contador"]}>{notifSinLeer}</span>
        )}
      </button>

      {abierto && (
        <>
          <div
            className={styles["respaldo-notif"]}
            onClick={onCerrar}
            aria-hidden="true"
          />
          <div className={styles["panel-notif"]}>
            <div className={styles["panel-notif__cabecera"]}>
              <span className={styles["panel-notif__titulo"]}>Notificaciones</span>
              <span className="etiqueta etiqueta--azul">{notifSinLeer} nuevas</span>
            </div>

            {notificaciones.length > 0 && (
              <div className={styles["panel-notif__acciones"]}>
                <button
                  type="button"
                  className={styles["panel-notif__accion"]}
                  onClick={marcarTodasLeidas}
                  disabled={notifSinLeer === 0}
                >
                  <CheckCheck size={14} />
                  Marcar como leído
                </button>
                <button
                  type="button"
                  className={`${styles["panel-notif__accion"]} ${styles["panel-notif__accion--peligro"]}`}
                  onClick={limpiarNotificaciones}
                >
                  <Trash2 size={14} />
                  Limpiar todo
                </button>
              </div>
            )}

            <div className={styles["panel-notif__lista"]}>
              {notificaciones.length === 0 ? (
                <p className={styles["panel-notif__vacio"]}>No tienes notificaciones.</p>
              ) : (
                notificaciones.map((n) => (
                  <NotificacionFila key={n.id} notif={n} onMarcarLeida={marcarLeida} />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
