import logging
import threading

from ..models import AuditoriaLog

logger = logging.getLogger(__name__)


class AsyncAuditService:
    @staticmethod
    def _guardar_log(data):
        try:
            AuditoriaLog.objects.create(**data)
        except Exception as e:
            logger.exception('Error al registrar auditoría asíncrona: %s', e)

    @classmethod
    def registrar(cls, usuario, accion, entidad_tipo, entidad_id, datos_previos, datos_nuevos):
        if usuario is None or not usuario.pk:
            usuario_id = None
            usuario_nombre = 'Sistema / Anónimo'
            usuario_correo = ''
            usuario_rol = ''
        else:
            usuario_id = usuario.pk
            usuario_nombre = usuario.nombre or ''
            usuario_correo = usuario.correo or ''
            usuario_rol = usuario.rol.nombre_rol if hasattr(usuario, 'rol') and usuario.rol else ''

        payload = {
            'usuario_id': usuario_id,
            'usuario_nombre': usuario_nombre,
            'usuario_correo': usuario_correo,
            'usuario_rol': usuario_rol,
            'accion': accion,
            'entidad_tipo': entidad_tipo,
            'entidad_id': str(entidad_id) if entidad_id is not None else None,
            'datos_previos': datos_previos,
            'datos_nuevos': datos_nuevos,
        }

        hilo = threading.Thread(target=cls._guardar_log, args=(payload,))
        hilo.daemon = True
        hilo.start()
