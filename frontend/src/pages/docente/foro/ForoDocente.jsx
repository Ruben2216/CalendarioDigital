import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useSesion } from '../../../hooks/useSesion.js';
import { useMensajeria } from '../../../hooks/useMensajeria.js';
import { enviarSolicitudBroadcast } from '../../../services/mensajeriaService.js';
import ConvLista from '../../../components/mensajeria/ConvLista.jsx';
import ChatPanel from '../../../components/mensajeria/ChatPanel.jsx';
import ModalSolicitud from './ModalSolicitud.jsx';
import styles from './ForoDocente.module.css';

export default function ForoDocente() {
  const { id_usuario, nombre, iniciales, plantel } = useSesion();
  const {
    conversaciones,
    idConvActiva,
    mensajes,
    cargandoMsgs,
    seleccionarConversacion,
    enviarMensaje,
    recargarMensajes,
    recargarConversaciones,
  } = useMensajeria(id_usuario);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorAdmin, setErrorAdmin] = useState(null);

  const convActiva = conversaciones.find((c) => c.id === idConvActiva) ?? null;
  const avatarUsuario = iniciales || nombre?.slice(0, 2).toUpperCase() || 'DC';

  const iniciarSolicitud = () => {
    setErrorAdmin(null);
    setModalAbierto(true);
  };

  const handleEnviarSolicitud = async (datos) => {
    setModalAbierto(false);
    setErrorAdmin(null);
    setEnviando(true);

    const metadatos = {
      tipo: 'solicitud_espacio',
      titulo: 'Solicitud de espacio o evento',
      campos: [
        { clave: 'Actividad',    valor: datos.titulo },
        { clave: 'Tipo',         valor: datos.area },
        { clave: 'Fecha',        valor: datos.fecha },
        ...(datos.fechaFin
          ? [{ clave: 'Fecha fin', valor: datos.fechaFin }]
          : []),
        ...(datos.horaInicio
          ? [{ clave: 'Horario', valor: `${datos.horaInicio} – ${datos.horaFin || '?'}` }]
          : [{ clave: 'Horario', valor: 'Todo el día' }]),
        { clave: 'Lugar / Grupo', valor: datos.lugar || '—' },
        ...(datos.recursos?.length
          ? [{ clave: 'Recursos', valor: datos.recursos.join(', ') }]
          : []),
        { clave: 'Plantel',       valor: datos.plantel },
        ...(datos.observaciones
          ? [{ clave: 'Observaciones', valor: datos.observaciones }]
          : []),
      ],
    };

    const textoMensaje = datos.observaciones
      || `Solicitud de espacio para "${datos.titulo}" el ${datos.fecha}.`;

    try {
      await enviarSolicitudBroadcast(id_usuario, textoMensaje, metadatos);
      await recargarConversaciones();
    } catch {
      setErrorAdmin('No se pudo enviar la solicitud. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={styles['foro']}>
      <header className={styles['foro__encabezado']}>
        <div>
          <h2 className={styles['foro__titulo']}>Foro docente</h2>
          <span className="etiqueta etiqueta--azul">Mensajería interna</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <button
            type="button"
            className="boton boton--primario"
            onClick={iniciarSolicitud}
            disabled={enviando}
          >
            <Plus size={16} />
            {enviando ? 'Enviando…' : 'Nueva solicitud'}
          </button>
          {errorAdmin && (
            <span style={{ fontSize: 11, color: 'var(--red)' }}>{errorAdmin}</span>
          )}
        </div>
      </header>

      <div className={styles['foro__cuerpo']}>
        <ConvLista
          conversaciones={conversaciones}
          idActiva={idConvActiva}
          onSeleccionar={seleccionarConversacion}
        />
        <ChatPanel
          conversacion={convActiva}
          mensajes={mensajes}
          cargando={cargandoMsgs}
          inicialesUsuario={avatarUsuario}
          onEnviar={enviarMensaje}
          onActualizar={recargarMensajes}
          onNuevaSolicitud={iniciarSolicitud}
          esAdmin={false}
        />
      </div>

      <ModalSolicitud
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        onEnviar={handleEnviarSolicitud}
        plantel={plantel}
      />
    </div>
  );
}
