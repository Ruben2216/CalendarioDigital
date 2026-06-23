import logging
from datetime import datetime, timedelta

from django.conf import settings
from django.db.models import Q
from django.utils import timezone

logger = logging.getLogger(__name__)

_TOKEN_URI = 'https://oauth2.googleapis.com/token'


# ---------------------------------------------------------------------------
# Cliente de la API
# ---------------------------------------------------------------------------

def _obtener_servicio(usuario):
    """Construye el cliente de Google Calendar para el usuario dado.
    Refresca el access_token si está vencido. Devuelve None si no tiene credenciales."""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
    from ..models import GoogleOauthCredential

    try:
        creds_db = usuario.google_credentials
    except GoogleOauthCredential.DoesNotExist:
        return None

    credenciales = Credentials(
        token=creds_db.access_token,
        refresh_token=creds_db.refresh_token,
        token_uri=_TOKEN_URI,
        client_id=settings.GOOGLE_OAUTH2_CLIENT_ID,
        client_secret=settings.GOOGLE_OAUTH2_CLIENT_SECRET,
        scopes=creds_db.scopes.split(' ') if creds_db.scopes else [],
    )

    if not credenciales.valid:
        if credenciales.expired and credenciales.refresh_token:
            try:
                credenciales.refresh(Request())
                creds_db.access_token = credenciales.token
                if credenciales.expiry:
                    expiry = credenciales.expiry
                    if expiry.tzinfo is None:
                        expiry = timezone.make_aware(expiry)
                    creds_db.expiry = expiry
                creds_db.save(update_fields=['access_token', 'expiry'])
            except Exception:
                logger.warning('No se pudo refrescar el token de %s', usuario.correo)
                return None
        else:
            return None

    try:
        return build('calendar', 'v3', credentials=credenciales)
    except Exception:
        logger.warning('No se pudo construir el servicio de GCal para %s', usuario.correo)
        return None


# ---------------------------------------------------------------------------
# Construcción del body del evento para la API de Google
# ---------------------------------------------------------------------------

def _construir_body(evento):
    partes_desc = []
    if evento.area:
        partes_desc.append(evento.area)
    if evento.lugar:
        partes_desc.append(f'Lugar: {evento.lugar}')
    description = '\n'.join(partes_desc)

    if evento.hora_inicio:
        inicio_dt = datetime.combine(evento.fecha_inicio, evento.hora_inicio)
        if evento.fecha_fin and evento.hora_fin:
            fin_dt = datetime.combine(evento.fecha_fin, evento.hora_fin)
        elif evento.fecha_fin:
            fin_dt = datetime.combine(evento.fecha_fin, evento.hora_inicio)
        else:
            fin_dt = inicio_dt + timedelta(hours=1)
        return {
            'summary': evento.titulo,
            'description': description,
            'start': {'dateTime': inicio_dt.isoformat(), 'timeZone': 'America/Mexico_City'},
            'end': {'dateTime': fin_dt.isoformat(), 'timeZone': 'America/Mexico_City'},
        }
    else:
        fecha_fin = (evento.fecha_fin or evento.fecha_inicio) + timedelta(days=1)
        return {
            'summary': evento.titulo,
            'description': description,
            'start': {'date': evento.fecha_inicio.isoformat()},
            'end': {'date': fecha_fin.isoformat()},
        }


# ---------------------------------------------------------------------------
# Resolución de usuarios con acceso al evento
# ---------------------------------------------------------------------------

def _usuarios_con_acceso(evento):
    """Devuelve los usuarios que tienen Google Calendar vinculado Y pueden ver el evento."""
    from ..models import GoogleOauthCredential, UsuarioPlantel

    # Todos los usuarios con credencial activa
    credenciales = list(
        GoogleOauthCredential.objects
        .select_related('usuario__rol')
        .prefetch_related('usuario__planteles_asignados')
        .all()
    )

    if evento.plantel_id is None:
        # Evento general: visible para todos los roles con cuenta local
        return [c.usuario for c in credenciales]

    # Evento de plantel específico: solo usuarios asignados a ese plantel
    if evento.turno_id:
        ids_permitidos = set(
            UsuarioPlantel.objects
            .filter(plantel_id=evento.plantel_id, turno_id=evento.turno_id)
            .values_list('usuario_id', flat=True)
        )
    else:
        ids_permitidos = set(
            UsuarioPlantel.objects
            .filter(plantel_id=evento.plantel_id)
            .values_list('usuario_id', flat=True)
        )

    # Incluir superusuarios (ven todo aunque no tengan plantel asignado)
    resultado = []
    for c in credenciales:
        rol = c.usuario.rol.nombre_rol
        if rol == 'superusuario' or c.usuario_id in ids_permitidos:
            resultado.append(c.usuario)
    return resultado


# ---------------------------------------------------------------------------
# Sincronización multi-usuario
# ---------------------------------------------------------------------------

def sincronizar_creacion(evento):
    """Crea el evento en el Google Calendar de todos los usuarios con acceso."""
    from ..models import EventoGoogleSync

    for usuario in _usuarios_con_acceso(evento):
        service = _obtener_servicio(usuario)
        if not service:
            continue
        try:
            resultado = service.events().insert(
                calendarId='primary', body=_construir_body(evento)
            ).execute()
            EventoGoogleSync.objects.update_or_create(
                evento=evento, usuario=usuario,
                defaults={'google_event_id': resultado.get('id', '')},
            )
        except Exception:
            logger.warning('GCal CREATE falló: evento=%s usuario=%s', evento.id_evento, usuario.correo)


def sincronizar_actualizacion(evento):
    """Actualiza el evento en los calendarios donde ya estaba; lo crea para nuevos usuarios con acceso."""
    from ..models import EventoGoogleSync

    body = _construir_body(evento)
    syncs_existentes = {
        s.usuario_id: s
        for s in EventoGoogleSync.objects.filter(evento=evento).select_related('usuario')
    }
    usuarios_con_acceso = {u.id_usuario: u for u in _usuarios_con_acceso(evento)}

    for uid, sync in syncs_existentes.items():
        service = _obtener_servicio(sync.usuario)
        if not service:
            continue
        try:
            service.events().update(
                calendarId='primary', eventId=sync.google_event_id, body=body
            ).execute()
        except Exception:
            logger.warning('GCal UPDATE falló: evento=%s usuario=%s', evento.id_evento, sync.usuario.correo)

    # Nuevos usuarios con acceso que no tenían sync
    for uid, usuario in usuarios_con_acceso.items():
        if uid in syncs_existentes:
            continue
        service = _obtener_servicio(usuario)
        if not service:
            continue
        try:
            resultado = service.events().insert(
                calendarId='primary', body=body
            ).execute()
            EventoGoogleSync.objects.create(
                evento=evento, usuario=usuario, google_event_id=resultado.get('id', '')
            )
        except Exception:
            logger.warning('GCal CREATE (update-path) falló: evento=%s usuario=%s', evento.id_evento, usuario.correo)


def sincronizar_eliminacion(evento):
    """Elimina el evento de todos los Google Calendars donde estaba sincronizado.
    Debe llamarse ANTES de event.delete() para poder leer los registros de sync."""
    from ..models import EventoGoogleSync

    syncs = list(EventoGoogleSync.objects.filter(evento=evento).select_related('usuario'))
    for sync in syncs:
        service = _obtener_servicio(sync.usuario)
        if not service:
            continue
        try:
            service.events().delete(
                calendarId='primary', eventId=sync.google_event_id
            ).execute()
        except Exception:
            logger.warning('GCal DELETE falló: gcal_id=%s usuario=%s', sync.google_event_id, sync.usuario.correo)
    # Los registros EventoGoogleSync se eliminan en cascada al borrar el evento


def backfill_usuario(usuario):
    """Sincroniza al Google Calendar del usuario todos los eventos que le son visibles
    y que aún no están sincronizados. Se llama al vincular la cuenta."""
    from ..models import EventoGoogleSync, Evento, UsuarioPlantel

    service = _obtener_servicio(usuario)
    if not service:
        return

    rol = usuario.rol.nombre_rol
    plantel_para_todos = Q(plantel__isnull=True)

    if rol == 'superusuario':
        eventos = Evento.objects.filter(plantel_para_todos)
    elif rol == 'admin':
        plantel_ids = list(
            UsuarioPlantel.objects.filter(usuario=usuario).values_list('plantel_id', flat=True)
        )
        eventos = Evento.objects.filter(plantel_para_todos | Q(plantel_id__in=plantel_ids))
    else:
        plantel_ids = list(
            UsuarioPlantel.objects.filter(usuario=usuario).values_list('plantel_id', flat=True)
        )
        turno_ids = list(
            UsuarioPlantel.objects.filter(usuario=usuario).values_list('turno_id', flat=True)
        )
        cond_plantel = plantel_para_todos | Q(plantel_id__in=plantel_ids)
        cond_turno = Q(turno__isnull=True) | Q(turno_id__in=turno_ids)
        eventos = Evento.objects.filter(cond_plantel & cond_turno)

    ya_sincronizados = set(
        EventoGoogleSync.objects.filter(usuario=usuario).values_list('evento_id', flat=True)
    )
    body_cache = {}

    for evento in eventos:
        if evento.id_evento in ya_sincronizados:
            continue
        if evento.id_evento not in body_cache:
            body_cache[evento.id_evento] = _construir_body(evento)
        try:
            resultado = service.events().insert(
                calendarId='primary', body=body_cache[evento.id_evento]
            ).execute()
            EventoGoogleSync.objects.create(
                evento=evento, usuario=usuario, google_event_id=resultado.get('id', '')
            )
        except Exception:
            logger.warning('Backfill falló: evento=%s usuario=%s', evento.id_evento, usuario.correo)
