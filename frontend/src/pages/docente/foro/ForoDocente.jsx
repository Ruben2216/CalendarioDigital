import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useSesion } from '../../../hooks/useSesion.js';
import { useMensajeria } from '../../../hooks/useMensajeria.js';
import { obtenerOCrearConversacion } from '../../../services/mensajeriaService.js';
import ConvLista from '../../../components/mensajeria/ConvLista.jsx';
import ChatPanel from '../../../components/mensajeria/ChatPanel.jsx';
import ModalSolicitud from './ModalSolicitud.jsx';
import styles from './ForoDocente.module.css';

const BACKEND =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000');

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
  const [cargandoAdmin, setCargandoAdmin] = useState(false);
  const [errorAdmin, setErrorAdmin] = useState(null);

  const convActiva = conversaciones.find((c) => c.id === idConvActiva) ?? null;
  const avatarUsuario = iniciales || nombre?.slice(0, 2).toUpperCase() || 'DC';

  const iniciarSolicitud = async () => {
    setErrorAdmin(null);

    // Si ya hay una conversación con un admin, simplemente la seleccionamos
    const convAdmin = conversaciones.find(
      (c) => c.otro_usuario?.rol === 'admin' || c.otro_usuario?.rol === 'superusuario'
    );
    if (convAdmin) {
      seleccionarConversacion(convAdmin.id);
      setModalAbierto(true);
      return;
    }

    // Buscar el admin del plantel para crear la conversación
    setCargandoAdmin(true);
    try {
      // 1° intento: admin del mismo plantel
      let candidatos = [];
      if (plantel?.id) {
        const r = await fetch(`${BACKEND}/api/usuarios/?rol=admin&plantel=${plantel.id}`);
        candidatos = await r.json();
      }
      // 2° fallback: superusuario (no pertenece a ningún plantel en específico)
      if (!Array.isArray(candidatos) || candidatos.length === 0) {
        const r = await fetch(`${BACKEND}/api/usuarios/?rol=superusuario`);
        candidatos = await r.json();
      }
      if (!Array.isArray(candidatos) || candidatos.length === 0) {
        setErrorAdmin('No hay un administrador disponible. Contacta soporte.');
        return;
      }

      const { id_conversacion } = await obtenerOCrearConversacion(id_usuario, candidatos[0].id);
      await recargarConversaciones();
      seleccionarConversacion(id_conversacion);
      setModalAbierto(true);
    } catch {
      setErrorAdmin('No se pudo conectar con el administrador. Intenta de nuevo.');
    } finally {
      setCargandoAdmin(false);
    }
  };

  const handleEnviarSolicitud = async (datos) => {
    setModalAbierto(false);

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

    await enviarMensaje(textoMensaje, metadatos);
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
            disabled={cargandoAdmin}
          >
            <Plus size={16} />
            {cargandoAdmin ? 'Conectando…' : 'Nueva solicitud'}
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
