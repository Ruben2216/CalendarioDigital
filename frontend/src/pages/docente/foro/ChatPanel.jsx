import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import BurbujaMensaje from './BurbujaMensaje.jsx';
import styles from './ChatPanel.module.css';

export default function ChatPanel({ conversacion, onEnviar, inicialesUsuario }) {
  const [texto, setTexto] = useState('');
  const listaRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (listaRef.current) {
      listaRef.current.scrollTop = listaRef.current.scrollHeight;
    }
  }, [conversacion?.mensajes]);

  const enviar = () => {
    const val = texto.trim();
    if (!val) return;
    onEnviar(val);
    setTexto('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const alTecla = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  };

  const ajustarAltura = (e) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    setTexto(el.value);
  };

  if (!conversacion) {
    return (
      <div className={styles['chat-panel--vacio']}>
        <p>Selecciona una conversación</p>
      </div>
    );
  }

  return (
    <div className={styles['chat-panel']}>
      <div className={styles['chat-panel__cabecera']}>
        <span className={styles['chat-panel__avatar']}>{conversacion.iniciales}</span>
        <div>
          <strong className={styles['chat-panel__nombre']}>{conversacion.destinatario}</strong>
          <span className={styles['chat-panel__estado']}>En línea</span>
        </div>
      </div>

      <div className={styles['chat-panel__mensajes']} ref={listaRef}>
        {conversacion.mensajes.map((m) => (
          <BurbujaMensaje key={m.id} mensaje={m} inicialesUsuario={inicialesUsuario} />
        ))}
      </div>

      <div className={styles['chat-panel__entrada']}>
        <textarea
          ref={textareaRef}
          className={styles['chat-panel__textarea']}
          placeholder="Escribe un mensaje..."
          value={texto}
          onChange={ajustarAltura}
          onKeyDown={alTecla}
          rows={1}
        />
        <button
          type="button"
          className={styles['chat-panel__enviar']}
          onClick={enviar}
          disabled={!texto.trim()}
          aria-label="Enviar"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
