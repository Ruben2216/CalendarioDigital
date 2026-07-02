import styles from "./MensajeError.module.css";

export default function MensajeError({ children }) {
  return <p className={styles["mensaje-error"]}>{children}</p>;
}
