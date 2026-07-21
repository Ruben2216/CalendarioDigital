import logging

from ..models import Notificacion
from . import notificaciones_push as push

logger = logging.getLogger(__name__)

def notificar(destinatario, categoria, titulo, mensaje='', data=None):
    """Crea la notificación personal y la envía por push al `destinatario`"""
    if destinatario is None or not getattr(destinatario, 'pk', None):
        return None

    notif = Notificacion.objects.create(
        categoria=categoria,
        titulo=titulo,
        mensaje=mensaje or '',
        audiencia=Notificacion.AUDIENCIA_PERSONAL,
        destinatario=destinatario,
    )

    try:
        carga = {'tipo': categoria, 'id_notificacion': notif.id_notificacion}
        carga.update(data or {})
        push.enviar_a_usuario(destinatario, titulo, mensaje or '', carga)
    except Exception:
        logger.exception(
            'Fallo al enviar push personal (notif %s a usuario %s)',
            notif.id_notificacion, destinatario.pk,
        )

    return notif