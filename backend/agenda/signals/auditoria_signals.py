from datetime import date, datetime, time
from uuid import UUID

from django.db.models.signals import pre_save, post_save, pre_delete
from django.dispatch import receiver
from django.forms.models import model_to_dict

from ..models import Anuncio, Evento, SolicitudAdmin, Usuario
from ..middleware.audit_context import get_current_user
from ..services.audit_service import AsyncAuditService

MODELOS_AUDITADOS = (Evento, Anuncio, SolicitudAdmin, Usuario)


def _serializar(instance):
    datos = model_to_dict(instance)
    for k, v in datos.items():
        if isinstance(v, (date, datetime)):
            datos[k] = v.isoformat()
        elif isinstance(v, time):
            datos[k] = v.strftime('%H:%M:%S')
        elif isinstance(v, UUID):
            datos[k] = str(v)
    return datos


@receiver(pre_save)
def capturar_estado_previo(sender, instance, **kwargs):
    if not isinstance(instance, MODELOS_AUDITADOS):
        return

    if instance.pk:
        try:
            objeto_anterior = sender.objects.get(pk=instance.pk)
            instance._estado_previo_json = _serializar(objeto_anterior)
        except sender.DoesNotExist:
            instance._estado_previo_json = None
    else:
        instance._estado_previo_json = None


@receiver(pre_delete)
def auditar_eliminacion(sender, instance, **kwargs):
    if not isinstance(instance, MODELOS_AUDITADOS):
        return

    usuario = get_current_user()
    datos_previos = _serializar(instance)
    pk_name = instance._meta.pk.name
    entidad_id = getattr(instance, pk_name)

    AsyncAuditService.registrar(
        usuario=usuario,
        accion='ELIMINAR',
        entidad_tipo=sender.__name__,
        entidad_id=entidad_id,
        datos_previos=datos_previos,
        datos_nuevos=None,
    )


@receiver(post_save)
def auditar_guardado(sender, instance, created, **kwargs):
    if not isinstance(instance, MODELOS_AUDITADOS):
        return

    usuario = get_current_user()
    accion = 'CREAR' if created else 'ACTUALIZAR'
    datos_previos = getattr(instance, '_estado_previo_json', None) if not created else None
    datos_nuevos = _serializar(instance)
    pk_name = instance._meta.pk.name
    entidad_id = getattr(instance, pk_name)

    AsyncAuditService.registrar(
        usuario=usuario,
        accion=accion,
        entidad_tipo=sender.__name__,
        entidad_id=entidad_id,
        datos_previos=datos_previos,
        datos_nuevos=datos_nuevos,
    )
