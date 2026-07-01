import base64
import json as _json

from ..models import Grupo, Semestre, Usuario

ROLES_EMPLEADO = {'superusuario', 'admin', 'docente'}

_TURNOS_ALUMNO = {'M': 'Matutino', 'V': 'Vespertino'}


def _qr_data_uri(qr: str) -> str:
    if not qr:
        return ''
    if qr.startswith('data:'):
        return qr
    return f'data:image/png;base64,{qr}'


def _usuario_sesion(request):
    """Lee id_usuario del body o query params y devuelve el Usuario activo."""
    id_usuario = request.data.get('id_usuario') or request.query_params.get('id_usuario')
    try:
        return (
            Usuario.objects
            .select_related('rol')
            .prefetch_related('planteles_asignados__plantel', 'planteles_asignados__turno')
            .get(pk=int(id_usuario), activo=True)
        )
    except (TypeError, ValueError, Usuario.DoesNotExist):
        return None


def _usuario_google(request):
    """Resuelve el Usuario para operaciones de Google Calendar.

    El personal llega con pk entera; el alumno llega con su UUID institucional
    (id_api). El alumno puede no existir todavía como Usuario local: en ese caso
    devuelve None y el POST de vinculación lo crea.
    """
    id_param = request.data.get('id_usuario') or request.query_params.get('id_usuario')
    if id_param is None:
        return None
    id_str = str(id_param).strip()
    if id_str.isdigit():
        return Usuario.objects.select_related('rol').filter(pk=int(id_str), activo=True).first()
    return Usuario.objects.select_related('rol').filter(id_api=id_str, activo=True).first()


def _resolver_semestre_grupo(semestre_val, grupo_val):
    """Convierte semestre (1-6) y letra de grupo en sus instancias del catálogo."""
    semestre_obj = None
    if semestre_val not in (None, ''):
        try:
            semestre_obj = Semestre.objects.filter(id_semestre=int(semestre_val)).first()
        except (TypeError, ValueError):
            semestre_obj = None
    grupo_obj = None
    letra = (str(grupo_val).strip().upper() if grupo_val else '')
    if semestre_obj and letra:
        grupo_obj = Grupo.objects.filter(semestre=semestre_obj, letra_id=letra).first()
    return semestre_obj, grupo_obj


def _email_desde_id_token(id_token):
    """Extrae el campo email del payload JWT sin verificación de firma.
    Solo se usa cuando el token viene directamente de oauth2.googleapis.com/token."""
    try:
        parts = id_token.split('.')
        if len(parts) < 2:
            return None
        padding = 4 - len(parts[1]) % 4
        payload = _json.loads(base64.urlsafe_b64decode(parts[1] + '=' * padding))
        return payload.get('email')
    except Exception:
        return None
