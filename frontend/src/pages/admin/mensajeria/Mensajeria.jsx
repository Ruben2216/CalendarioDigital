import { useState } from 'react';
import { MessageSquare, UserPlus } from 'lucide-react';
import { useSesion } from '../../../hooks/useSesion.js';
import { useMensajeria } from '../../../hooks/useMensajeria.js';
import { useMediaQuery } from '../../../hooks/useMediaQuery.js';
import { obtenerOCrearConversacion, enviarMensaje as apiEnviarMensaje } from '../../../services/mensajeriaService.js';
import { crearEvento, listarCalendarios } from '../../../services/eventosService.js';
import { confirmarAccion, avisoCreado, avisoError } from '../../../lib/alertas.js';
import { useMensajeriaCtx } from '../../../context/MensajeriaContext.jsx';
import ConvLista from '../../../components/mensajeria/ConvLista.jsx';
import ChatPanel from '../../../components/mensajeria/ChatPanel.jsx';
import SelectorDocente from '../../../components/mensajeria/SelectorDocente.jsx';
import Modal from '../../../components/modal/Modal.jsx';
import styles from './Mensajeria.module.css';

export default function Mensajeria() {
  const { id_usuario, iniciales, plantel, rol } = useSesion();
  const { refrescar: refrescarBadge } = useMensajeriaCtx();
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [aprobando, setAprobando] = useState(false);
  const [rechazoAbierto, setRechazoAbierto] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [rechazando, setRechazando] = useState(false);
  const esMovil = useMediaQuery('(max-width: 720px)');

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

  const enviarResolucion = async (texto, metadatos) => {
    if (!idConvActiva) throw new Error('No hay una conversación activa.');
    await apiEnviarMensaje(id_usuario, idConvActiva, texto, metadatos);
    await recargarMensajes();
    await recargarConversaciones();
    refrescarBadge();
  };

  const aprobarSolicitud = async (mensaje) => {
    if (aprobando) return;
    const de = mensaje?.solicitud?.datos_evento;

    const { isConfirmed } = await confirmarAccion({
      titulo: 'Aprobar solicitud',
      html: de
        ? 'Se <b>creará el evento</b> en el calendario escolarizado y se le avisará al docente. ¿Continuar?'
        : 'Esta solicitud no trae datos del evento (es antigua); solo se marcará como aprobada. ¿Continuar?',
      confirmar: 'Aprobar',
    });
    if (!isConfirmed) return;

    setAprobando(true);
    try {
      if (de) {
        const cals = await listarCalendarios();
        const escolar = cals.find((c) => c.clave === 'escolarizado');
        if (!escolar) throw new Error('No se encontró el calendario escolarizado.');
        await crearEvento(
          {
            id_calendario: escolar.id,
            titulo:     de.titulo,
            tipo:       de.tipo,
            area:       de.area || '',
            fecha:      de.fecha,
            fechaFin:   de.fechaFin || null,
            horaInicio: de.horaInicio || '',
            horaFin:    de.horaFin || '',
            lugar:      de.lugar || '',
            plantel:    de.plantel || null,
            turno:      de.turno || null,
            semestre:   de.semestre ? Number(de.semestre) : null,
            grupo:      de.grupo || null,
          },
          { agregarAGoogleCalendar: false },
        );
      }

      await enviarResolucion(
        de
          ? 'Solicitud aprobada. El evento ya fue registrado en el calendario escolarizado.'
          : 'Solicitud aprobada.',
        {
          tipo: 'solicitud_aprobada',
          titulo: 'Solicitud aprobada',
          icono: 'check',
          campos: [
            { clave: 'Estado', valor: 'Aprobada' },
            ...(de ? [{ clave: 'Registrado en', valor: 'Calendario escolarizado' }] : []),
          ],
        },
      );
      avisoCreado(de ? 'Solicitud aprobada y evento creado' : 'Solicitud aprobada');
    } catch (e) {
      avisoError('No se pudo aprobar', e.message || 'Intenta de nuevo.');
    } finally {
      setAprobando(false);
    }
  };

  const abrirRechazo = () => {
    setMotivoRechazo('');
    setRechazoAbierto(true);
  };

  const confirmarRechazo = async () => {
    if (rechazando) return;
    const motivo = motivoRechazo.trim();
    setRechazando(true);
    try {
      await enviarResolucion(
        motivo ? `Solicitud rechazada. Motivo: ${motivo}` : 'Solicitud rechazada.',
        {
          tipo: 'solicitud_rechazada',
          titulo: 'Solicitud rechazada',
          icono: 'x',
          campos: [
            { clave: 'Estado', valor: 'Rechazada' },
            ...(motivo ? [{ clave: 'Motivo', valor: motivo }] : []),
          ],
        },
      );
      setRechazoAbierto(false);
    } catch (e) {
      avisoError('No se pudo rechazar', e.message || 'Intenta de nuevo.');
    } finally {
      setRechazando(false);
    }
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
          Contactar
        </button>
      </div>

      <div className={styles['mensajeria__layout']}>
        {(!esMovil || !idConvActiva) && (
          <ConvLista
            conversaciones={conversaciones}
            idActiva={idConvActiva}
            cargando={cargandoConvs}
            onSeleccionar={seleccionarConversacion}
            titulo={esSuperadmin ? 'Todos los planteles' : `Docentes · ${plantel?.nombre ?? ''}`}
          />
        )}

        {(!esMovil || idConvActiva) && (
          idConvActiva ? (
            (() => {
              const convActiva = conversaciones.find((c) => c.id === idConvActiva);
              const soloLectura = esSuperadmin && convActiva && convActiva.es_participante === false;
              return (
                <ChatPanel
                  mensajes={mensajes}
                  cargando={cargandoMsgs}
                  inicialesUsuario={iniciales}
                  conversacion={convActiva}
                  onEnviar={handleEnviar}
                  onActualizar={recargarMensajes}
                  esAdmin={!esSuperadmin}
                  onAprobar={aprobarSolicitud}
                  onRechazar={abrirRechazo}
                  onVolver={esMovil ? () => seleccionarConversacion(null) : null}
                  soloLectura={soloLectura}
                  onContactar={() => setSelectorAbierto(true)}
                />
              );
            })()
          ) : (
            <div className={styles['mensajeria__vacio']}>
              <MessageSquare size={32} strokeWidth={1.5} />
              <p>Selecciona una conversación o usa el botón Contactar.</p>
            </div>
          )
        )}
      </div>

      <SelectorDocente
        abierto={selectorAbierto}
        onCerrar={() => setSelectorAbierto(false)}
        onSeleccionar={handleSeleccionarDocente}
        idPlantel={plantel?.id ?? null}
        esSuperadmin={esSuperadmin}
        rol="docente"
        titulo="Contactar"
      />

      <Modal
        abierto={rechazoAbierto}
        titulo="Rechazar solicitud"
        onCerrar={() => setRechazoAbierto(false)}
        pie={
          <>
            <button type="button" className="boton boton--fantasma" onClick={() => setRechazoAbierto(false)}>
              Cancelar
            </button>
            <button type="button" className="boton boton--peligro" onClick={confirmarRechazo} disabled={rechazando}>
              {rechazando ? 'Rechazando…' : 'Rechazar solicitud'}
            </button>
          </>
        }
      >
        <label className="formulario__campo">
          <span className="formulario__etiqueta">
            Motivo del rechazo <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opcional)</span>
          </span>
          <textarea
            placeholder="Explica por qué se rechaza la solicitud (el docente lo verá en el chat)…"
            value={motivoRechazo}
            rows={4}
            onChange={(e) => setMotivoRechazo(e.target.value)}
          />
        </label>
      </Modal>
    </div>
  );
}
