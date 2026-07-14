import { useEffect, useRef, useState } from 'react';
import { Send, RefreshCw, Plus, ArrowLeft, Eye } from 'lucide-react';
import BurbujaMensaje from './BurbujaMensaje.jsx';
import styles from './ChatPanel.module.css';

export default function ChatPanel({
  conversacion,
  mensajes: mensajesProp,
  onEnviar,
  inicialesUsuario,
  esAdmin = false,
  onAprobar = null,
  onRechazar = null,
  cargando = false,
  onActualizar = null,
  onNuevaSolicitud = null,
  onVolver = null,
  soloLectura = false,
  onContactar = null,
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

  const pA = conversacion.participante_a ?? null;
  const pB = conversacion.participante_b ?? null;
  const observando = soloLectura && pA && pB;

  const nombreOtro = observando
    ? `${pA.nombre} ↔ ${pB.nombre}`
    : (conversacion.otro_usuario?.nombre ?? conversacion.destinatario ?? '—');
  const inicialesOtro = conversacion.otro_usuario?.iniciales ?? conversacion.iniciales ?? '?';
  const rolOtro = observando ? '' : (conversacion.otro_usuario?.rol ?? '');
  const plantelConv = conversacion.plantel ?? '';

  return (
    <div className={styles['chat-panel']}>
      <div className={styles['chat-panel__cabecera']}>
        {onVolver && (
          <button
            type="button"
            className={styles['chat-panel__volver']}
            onClick={onVolver}
            aria-label="Volver a conversaciones"
            title="Volver"
          >
            <ArrowLeft size={20} />
          </button>
        )}
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
        {mensajes.flatMap((m, i) => {
          let resuelta =
            m.solicitud?.tipo === 'solicitud_espacio' &&
            mensajes
              .slice(i + 1)
              .some((x) =>
                ['solicitud_aprobada', 'solicitud_rechazada', 'solicitud_vencida'].includes(x.solicitud?.tipo),
              );

          let vencida = false;
          if (m.solicitud?.tipo === 'solicitud_espacio' && !resuelta) {
            const de = m.solicitud.datos_evento;
            if (de && de.fecha && de.horaInicio) {
              const [yyyy, mm, dd] = de.fecha.split('-').map(Number);
              const [HH, MM] = de.horaInicio.split(':').map(Number);
              const eventDate = new Date(yyyy, mm - 1, dd, HH, MM);
              if (eventDate < new Date()) {
                vencida = true;
                resuelta = true;
              }
            }
          }

          let mensaje = { ...m };
          let iniUsuario = inicialesUsuario;
          let iniOtro = inicialesOtro;
          if (observando) {
            const esDeA = m.remitenteId === pA.id;
            mensaje = { ...mensaje, tipo: esDeA ? 'recibido' : 'enviado' };
            iniUsuario = pB.iniciales;
            iniOtro = pA.iniciales;
          }

          const nodos = [
            <BurbujaMensaje
              key={m.id}
              mensaje={mensaje}
              inicialesUsuario={iniUsuario}
              inicialesOtro={iniOtro}
              esAdmin={esAdmin}
              onAprobar={onAprobar}
              onRechazar={onRechazar}
              resuelta={resuelta}
            />
          ];

          if (vencida) {
            let tipoMsgVencida = esAdmin ? 'enviado' : 'recibido';
            if (observando) {
              const esDeA = m.remitenteId === pA.id;
              tipoMsgVencida = esDeA ? 'enviado' : 'recibido';
            }

            const msgVencida = {
              id: `vencida-${m.id}`,
              tipo: tipoMsgVencida,
              solicitud: {
                tipo: 'solicitud_vencida',
                titulo: 'Solicitud vencida',
                icono: 'reloj',
                campos: [
                  { clave: 'Estado', valor: 'Vencida' },
                  { clave: 'Motivo', valor: 'El tiempo de espera ha transcurrido.' }
                ]
              },
              texto: 'La solicitud ha vencido por tiempo.',
              hora: m.hora,
            };

            nodos.push(
              <BurbujaMensaje
                key={msgVencida.id}
                mensaje={msgVencida}
                inicialesUsuario={iniUsuario}
                inicialesOtro={iniOtro}
                esAdmin={esAdmin}
                resuelta={true}
              />
            );
          }

          return nodos;
        })}
      </div>

      {soloLectura ? (
        <div className={styles['chat-panel__aviso']}>
          <Eye size={16} />
          <span className={styles['chat-panel__aviso-texto']}>
            Solo visualización. Para escribirle a alguien usa el botón contactar.
          </span>
        </div>
      ) : (
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
      )}
    </div>
  );
}
