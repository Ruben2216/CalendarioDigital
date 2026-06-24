import { useState } from 'react';
import { Plus, UserPlus } from 'lucide-react';
import { useSesion } from '../../../hooks/useSesion.js';
import { useMensajeria } from '../../../hooks/useMensajeria.js';
import { useMediaQuery } from '../../../hooks/useMediaQuery.js';
import { enviarSolicitudBroadcast, obtenerOCrearConversacion } from '../../../services/mensajeriaService.js';
import ConvLista from '../../../components/mensajeria/ConvLista.jsx';
import ChatPanel from '../../../components/mensajeria/ChatPanel.jsx';
import SelectorDocente from '../../../components/mensajeria/SelectorDocente.jsx';
import ModalSolicitud from './ModalSolicitud.jsx';
import styles from './ForoDocente.module.css';

export default function ForoDocente() {
  const { id_usuario, nombre, iniciales, planteles = [] } = useSesion();
  // El docente puede estar en varios planteles; usamos el primero como plantel activo para las solicitudes
  const plantel = planteles[0]?.plantel ?? null;
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
  const [selectorAdminAbierto, setSelectorAdminAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorAdmin, setErrorAdmin] = useState(null);

  const convActiva = conversaciones.find((c) => c.id === idConvActiva) ?? null;
  const avatarUsuario = iniciales || nombre?.slice(0, 2).toUpperCase() || 'DC';
  const esMovil = useMediaQuery('(max-width: 720px)');

  const iniciarSolicitud = () => {
    setErrorAdmin(null);
    setModalAbierto(true);
  };

  const handleSeleccionarAdmin = async (idAdmin) => {
    setSelectorAdminAbierto(false);
    try {
      const { id_conversacion } = await obtenerOCrearConversacion(id_usuario, idAdmin);
      await recargarConversaciones();
      seleccionarConversacion(id_conversacion);
    } catch {
      setErrorAdmin('No se pudo abrir la conversación con el administrador.');
    }
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
      await enviarSolicitudBroadcast(id_usuario, textoMensaje, metadatos, plantel?.id ?? null, datos.horaInicio || null);
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
        <div className={styles['foro__titulo-bloque']}>
          <h2 className={styles['foro__titulo']}>Foro docente</h2>
          <span className="etiqueta etiqueta--azul">Mensajería interna</span>
        </div>
        <div className={styles['foro__acciones']}>
          <div className={styles['foro__acciones-fila']}>
            <button
              type="button"
              className="boton boton--fantasma"
              onClick={() => setSelectorAdminAbierto(true)}
            >
              <UserPlus size={16} />
              Contactar administrador
            </button>
            <button
              type="button"
              className="boton boton--primario"
              onClick={iniciarSolicitud}
              disabled={enviando}
            >
              <Plus size={16} />
              {enviando ? 'Enviando…' : 'Nueva solicitud'}
            </button>
          </div>
          {errorAdmin && (
            <span className={styles['foro__error']}>{errorAdmin}</span>
          )}
        </div>
      </header>

      <div className={styles['foro__cuerpo']}>
        {(!esMovil || !idConvActiva) && (
          <ConvLista
            conversaciones={conversaciones}
            idActiva={idConvActiva}
            onSeleccionar={seleccionarConversacion}
          />
        )}
        {(!esMovil || idConvActiva) && (
          <ChatPanel
            conversacion={convActiva}
            mensajes={mensajes}
            cargando={cargandoMsgs}
            inicialesUsuario={avatarUsuario}
            onEnviar={enviarMensaje}
            onActualizar={recargarMensajes}
            onNuevaSolicitud={iniciarSolicitud}
            esAdmin={false}
            onVolver={esMovil ? () => seleccionarConversacion(null) : null}
          />
        )}
      </div>

      <ModalSolicitud
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        onEnviar={handleEnviarSolicitud}
        plantel={plantel}
      />

      <SelectorDocente
        abierto={selectorAdminAbierto}
        onCerrar={() => setSelectorAdminAbierto(false)}
        onSeleccionar={handleSeleccionarAdmin}
        idPlantel={plantel?.id ?? null}
        esSuperadmin={false}
        rol="admin"
        titulo="Contactar administrador"
      />
    </div>
  );
}
