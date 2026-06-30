import { useState } from 'react';
import { Plus, UserPlus } from 'lucide-react';
import { useSesion } from '../../../hooks/useSesion.js';
import { useMensajeria } from '../../../hooks/useMensajeria.js';
import { useMediaQuery } from '../../../hooks/useMediaQuery.js';
import {
  obtenerOCrearConversacion,
  enviarMensaje as apiEnviarMensaje,
  listarAdminsSolicitud,
} from '../../../services/mensajeriaService.js';
import ConvLista from '../../../components/mensajeria/ConvLista.jsx';
import ChatPanel from '../../../components/mensajeria/ChatPanel.jsx';
import SelectorDocente from '../../../components/mensajeria/SelectorDocente.jsx';
import ModalSolicitud from './ModalSolicitud.jsx';
import styles from './ForoDocente.module.css';

export default function ForoDocente() {
  const { id_usuario, nombre, iniciales, planteles = [] } = useSesion();
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
  const [selectorSolicitudAbierto, setSelectorSolicitudAbierto] = useState(false);
  const [adminsSolicitud, setAdminsSolicitud] = useState([]);
  const [solicitudPendiente, setSolicitudPendiente] = useState(null);

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

    const asignacionSel = planteles.find((a) => a.plantel?.nombre === datos.plantel) ?? planteles[0] ?? null;
    const plantelId = asignacionSel?.plantel?.id ?? null;

    const dirigidoA = datos.especifico && (datos.semestre || datos.grupo)
      ? [datos.semestre ? `${datos.semestre}.º` : '', datos.grupo].filter(Boolean).join(' ')
      : '';

    const metadatos = {
      tipo: 'solicitud_espacio',
      titulo: 'Solicitud de espacio o evento',
      datos_evento: {
        titulo:    datos.titulo,
        tipo:      datos.tipo,
        area:      datos.area || '',
        fecha:     datos.fecha,
        fechaFin:  datos.fechaFin || null,
        horaInicio: datos.horaInicio || '',
        horaFin:   datos.horaFin || '',
        lugar:     datos.lugar || '',
        plantel:   datos.plantel || null,
        turno:     datos.turno || null,
        semestre:  datos.especifico && datos.semestre ? datos.semestre : null,
        grupo:     datos.especifico && datos.grupo ? datos.grupo : null,
      },
      campos: [
        { clave: 'Actividad',     valor: datos.titulo },
        { clave: 'Tipo de evento', valor: datos.tipoEtiqueta || '—' },
        ...(datos.area
          ? [{ clave: 'Área', valor: datos.area }]
          : []),
        { clave: 'Fecha',         valor: datos.fecha },
        ...(datos.fechaFin
          ? [{ clave: 'Fecha fin', valor: datos.fechaFin }]
          : []),
        ...(datos.horaInicio
          ? [{ clave: 'Horario', valor: `${datos.horaInicio} – ${datos.horaFin || '?'}` }]
          : [{ clave: 'Horario', valor: 'Todo el día' }]),
        { clave: 'Lugar', valor: datos.lugar || '—' },
        ...(datos.recursos?.length
          ? [{ clave: 'Recursos', valor: datos.recursos.join(', ') }]
          : []),
        { clave: 'Plantel',       valor: datos.plantel || '—' },
        { clave: 'Turno',         valor: datos.turno || '—' },
        ...(dirigidoA
          ? [{ clave: 'Dirigido a', valor: dirigidoA }]
          : []),
        ...(datos.observaciones
          ? [{ clave: 'Observaciones', valor: datos.observaciones }]
          : []),
      ],
    };

    const textoMensaje = 'Solicitud de espacio o evento';

    try {
      const admins = await listarAdminsSolicitud(plantelId, datos.turno || null);
      if (!admins.length) {
        setErrorAdmin('No hay un administrador asignado a ese plantel y turno.');
        setEnviando(false);
        return;
      }
      if (admins.length === 1) {
        await enviarSolicitudAAdmin(admins[0].id, textoMensaje, metadatos);
        return;
      }
      setSolicitudPendiente({ texto: textoMensaje, metadatos });
      setAdminsSolicitud(admins);
      setSelectorSolicitudAbierto(true);
      setEnviando(false);
    } catch {
      setErrorAdmin('No se pudo enviar la solicitud. Intenta de nuevo.');
      setEnviando(false);
    }
  };

  const enviarSolicitudAAdmin = async (idAdmin, texto, metadatos) => {
    setEnviando(true);
    setErrorAdmin(null);
    try {
      const { id_conversacion } = await obtenerOCrearConversacion(id_usuario, idAdmin);
      await apiEnviarMensaje(id_usuario, id_conversacion, texto, metadatos);
      await recargarConversaciones();
      seleccionarConversacion(id_conversacion);
    } catch {
      setErrorAdmin('No se pudo enviar la solicitud. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const handleElegirAdminSolicitud = async (idAdmin) => {
    setSelectorSolicitudAbierto(false);
    if (!solicitudPendiente) return;
    const { texto, metadatos } = solicitudPendiente;
    setSolicitudPendiente(null);
    setAdminsSolicitud([]);
    await enviarSolicitudAAdmin(idAdmin, texto, metadatos);
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
        asignaciones={planteles}
      />

      <SelectorDocente
        abierto={selectorAdminAbierto}
        onCerrar={() => setSelectorAdminAbierto(false)}
        onSeleccionar={handleSeleccionarAdmin}
        idUsuario={id_usuario}
        esSuperadmin={false}
        titulo="Contactar administrador"
      />

      <SelectorDocente
        abierto={selectorSolicitudAbierto}
        onCerrar={() => { setSelectorSolicitudAbierto(false); setSolicitudPendiente(null); }}
        onSeleccionar={handleElegirAdminSolicitud}
        lista={adminsSolicitud}
        titulo="¿A qué administrador enviar la solicitud?"
      />
    </div>
  );
}
