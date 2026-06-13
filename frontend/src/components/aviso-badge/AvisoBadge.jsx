import { Eye } from 'lucide-react';
import styles from './AvisoBadge.module.css';

export default function AvisoBadge({ texto, variante = 'naranja', icono }) {
  const Icono = icono ?? Eye;
  return (
    <div className={`${styles['aviso']} ${styles[`aviso--${variante}`]}`}>
      <Icono size={14} />
      <span>{texto}</span>
    </div>
  );
}
