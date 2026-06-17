import { useState } from 'react';
import { MessageSquare, UserPlus } from 'lucide-react';
import { useSesion } from '../../../hooks/useSesion.js';
import { useMensajeria } from '../../../hooks/useMensajeria.js';
import { obtenerOCrearConversacion } from '../../../services/mensajeriaService.js';
import { useMensajeriaCtx } from '../../../context/MensajeriaContext.jsx';
import ConvLista from '../../../components/mensajeria/ConvLista.jsx';
import ChatPanel from '../../../components/mensajeria/ChatPanel.jsx';
import SelectorDocente from '../../../components/mensajeria/SelectorDocente.jsx';
import styles from './Mensajeria.module.css';

export default function Mensajeria() {
  const { id_usuario, iniciales, plantel, rol } = useSesion();
  const { refrescar: refrescarBadge } = useMensajeriaCtx();
  const [selectorAbierto, setSelectorAbierto] = useState(false);

  const {
    conversaciones,
    idConvActiva,
    mensajes,
    cargandoConvs,
    cargandoMsgs,
    seleccionarConversacion,
    enviarMensaje,
    recargarMensajes,
    recargarConversaciones,
  } = useMensajeria(id_usuario);

  const esSuperadmin = rol === 'superusuario';

  const handleSeleccionarDocente = async (idDocente) => {
    setSelectorAbierto(false);
    try {
      const { id_conversacion } = await obtenerOCrearConversacion(id_usuario, idDocente);
      await recargarConversaciones();
      seleccionarConversacion(id_conversacion);
    } catch (e) {
      console.error('Error al iniciar conversación:', e.message);
    }
  };

  const handleEnviar = async (texto, metadatos = null) => {
    await enviarMensaje(texto, metadatos);
    refrescarBadge();
  };

  const aprobarSolicitud = async () => {
    await handleEnviar(
      'Solicitud aprobada. El evento ya aparece en el calendario institucional.',
      {
        tipo: 'solicitud_aprobada',
        titulo: 'Solicitud aprobada',
        icono: 'check',
        campos: [
          { clave: 'Estado',        valor: 'Aprobada' },
          { clave: 'Registrado en', valor: 'Calendario institucional' },
        ],
      }
    );
  };

  return (
    <div className={styles['mensajeria']}>
      <div className={styles['mensajeria__encabezado']}>
        <div>
          <h2 className={styles['mensajeria__titulo']}>Mensajería</h2>
          <p className={styles['mensajeria__subtitulo']}>
            {esSuperadmin ? 'Todos los planteles' : `Docentes · ${plantel?.nombre ?? 'COBACH'}`}
          </p>
        </div>
        <button
          type="button"
          className="boton boton--primario"
          onClick={() => setSelectorAbierto(true)}
        >
          <UserPlus size={16} />
          Contactar docente
        </button>
      </div>

      <div className={styles['mensajeria__layout']}>
        <ConvLista
          conversaciones={conversaciones}
          idActiva={idConvActiva}
          cargando={cargandoConvs}
          onSeleccionar={seleccionarConversacion}
          titulo={esSuperadmin ? 'Todos los planteles' : `Docentes · ${plantel?.nombre ?? ''}`}
        />

        {idConvActiva ? (
          <ChatPanel
            mensajes={mensajes}
            cargando={cargandoMsgs}
            inicialesUsuario={iniciales}
            conversacion={conversaciones.find((c) => c.id === idConvActiva)}
            onEnviar={handleEnviar}
            onActualizar={recargarMensajes}
            esAdmin
            onAprobar={aprobarSolicitud}
          />
        ) : (
          <div className={styles['mensajeria__vacio']}>
            <MessageSquare size={32} strokeWidth={1.5} />
            <p>Selecciona una conversación o contacta a un docente.</p>
          </div>
        )}
      </div>

      <SelectorDocente
        abierto={selectorAbierto}
        onCerrar={() => setSelectorAbierto(false)}
        onSeleccionar={handleSeleccionarDocente}
        idPlantel={plantel?.id ?? null}
        esSuperadmin={esSuperadmin}
      />
    </div>
  );
}
