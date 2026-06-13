import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useSesion } from '../../../hooks/useSesion.js';
import { CONVERSACIONES_MOCK } from '../../../data/foro.js';
import ConvLista from './ConvLista.jsx';
import ChatPanel from './ChatPanel.jsx';
import ModalSolicitud from './ModalSolicitud.jsx';
import styles from './ForoDocente.module.css';

export default function ForoDocente() {
  const { nombre, iniciales } = useSesion();
  const [conversaciones, setConversaciones] = useState(CONVERSACIONES_MOCK);
  const [idActiva, setIdActiva] = useState(CONVERSACIONES_MOCK[0]?.id ?? null);
  const [modalAbierto, setModalAbierto] = useState(false);

  const convActiva = conversaciones.find((c) => c.id === idActiva) ?? null;

  const enviarMensaje = (texto) => {
    setConversaciones((prev) =>
      prev.map((c) => {
        if (c.id !== idActiva) return c;
        const nuevo = {
          id: `m-${Date.now()}`,
          tipo: 'enviado',
          hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          texto,
        };
        return { ...c, mensajes: [...c.mensajes, nuevo], sinLeer: 0 };
      })
    );
  };

  const enviarSolicitud = (form) => {
    const recursoTexto = form.recursos.length > 0 ? form.recursos.join(' + ') : 'Sin recurso especificado';
    const solicitud = {
      titulo: 'Solicitud de espacio',
      icono: 'calendario',
      campos: [
        { clave: 'Actividad', valor: form.actividad },
        { clave: 'Fecha', valor: form.fecha },
        { clave: 'Horario', valor: form.horario },
        { clave: 'Grupo', valor: form.grupo },
        { clave: 'Materia', valor: form.materia },
        { clave: 'Recurso', valor: recursoTexto },
        ...(form.observaciones ? [{ clave: 'Obs.', valor: form.observaciones }] : []),
      ],
    };
    const texto = `Solicito el uso de ${recursoTexto} para el ${form.fecha} en el horario ${form.horario}, grupo ${form.grupo}.`;
    setConversaciones((prev) =>
      prev.map((c) => {
        if (c.id !== idActiva) return c;
        const nuevo = {
          id: `m-${Date.now()}`,
          tipo: 'enviado',
          hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          texto,
          solicitud,
        };
        return { ...c, mensajes: [...c.mensajes, nuevo], sinLeer: 0 };
      })
    );
    setModalAbierto(false);
  };

  const avatarUsuario = iniciales || nombre.slice(0, 2).toUpperCase() || 'DC';

  return (
    <div className={styles['foro']}>
      <header className={styles['foro__encabezado']}>
        <div>
          <h2 className={styles['foro__titulo']}>Foro docente</h2>
          <span className="etiqueta etiqueta--azul">Mensajería interna</span>
        </div>
        <button type="button" className="boton boton--primario" onClick={() => setModalAbierto(true)}>
          <Plus size={16} />
          Nueva solicitud
        </button>
      </header>

      <div className={styles['foro__cuerpo']}>
        <ConvLista
          conversaciones={conversaciones}
          idActiva={idActiva}
          onSeleccionar={setIdActiva}
        />
        <ChatPanel
          conversacion={convActiva}
          onEnviar={enviarMensaje}
          inicialesUsuario={avatarUsuario}
        />
      </div>

      <ModalSolicitud
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        onEnviar={enviarSolicitud}
      />
    </div>
  );
}
