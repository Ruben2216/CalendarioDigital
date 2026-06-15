import { useEffect, useRef, useState } from 'react';
import { Send, RefreshCw, Plus } from 'lucide-react';
import BurbujaMensaje from './BurbujaMensaje.jsx';
import styles from './ChatPanel.module.css';

export default function ChatPanel({
  conversacion,
  mensajes: mensajesProp,
  onEnviar,
  inicialesUsuario,
  esAdmin = false,
  onAprobar = null,
  cargando = false,
  onActualizar = null,
  onNuevaSolicitud = null,
}) {
  const [texto, setTexto] = useState('');
  const listaRef = useRef(null);
  const textareaRef = useRef(null);

  // mensajes viene como prop separada o, si no, de conversacion.mensajes (legacy)
  const mensajes = mensajesProp ?? conversacion?.mensajes ?? [];

  useEffect(() => {
    if (listaRef.current) {
      listaRef.current.scrollTop = listaRef.current.scrollHeight;
    }
  }, [mensajes]);

  const enviar = () => {
    const val = texto.trim();
    if (!val) return;
    onEnviar(val);
    setTexto('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
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

  const nombreOtro = conversacion.otro_usuario?.nombre ?? conversacion.destinatario ?? '—';
  const inicialesOtro = conversacion.otro_usuario?.iniciales ?? conversacion.iniciales ?? '?';
  const rolOtro = conversacion.otro_usuario?.rol ?? '';
  const plantelConv = conversacion.plantel ?? '';

  return (
    <div className={styles['chat-panel']}>
      <div className={styles['chat-panel__cabecera']}>
        <span className={styles['chat-panel__avatar']}>{inicialesOtro}</span>
        <div className={styles['chat-panel__cab-info']}>
          <strong className={styles['chat-panel__nombre']}>{nombreOtro}</strong>
          <span className={styles['chat-panel__estado']}>
            {rolOtro && plantelConv ? `${rolOtro} · ${plantelConv}` : rolOtro || 'En línea'}
          </span>
        </div>

        {onActualizar && (
          <button
            type="button"
            className={styles['chat__actualizar']}
            onClick={onActualizar}
            disabled={cargando}
            title="Actualizar mensajes"
            aria-label="Actualizar mensajes"
          >
            <RefreshCw
              size={15}
              className={cargando ? styles['chat__actualizar--girando'] : ''}
            />
          </button>
        )}
      </div>

      <div className={styles['chat-panel__mensajes']} ref={listaRef}>
        {mensajes.map((m) => (
          <BurbujaMensaje
            key={m.id}
            mensaje={m}
            inicialesUsuario={inicialesUsuario}
            esAdmin={esAdmin}
            onAprobar={onAprobar}
          />
        ))}
      </div>

      <div className={styles['chat-panel__entrada']}>
        {onNuevaSolicitud && (
          <button
            type="button"
            className={styles['chat-panel__solicitud']}
            onClick={onNuevaSolicitud}
            title="Nueva solicitud"
            aria-label="Nueva solicitud formal"
          >
            <Plus size={18} />
          </button>
        )}
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
