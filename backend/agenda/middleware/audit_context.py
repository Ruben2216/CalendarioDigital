import contextvars
import json

from ..models import Usuario

_current_user = contextvars.ContextVar('current_user', default=None)


class AuditContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        usuario = self._extraer_usuario(request)
        token = _current_user.set(usuario)
        try:
            return self.get_response(request)
        finally:
            _current_user.reset(token)

    def _extraer_usuario(self, request):
        id_usuario = request.GET.get('id_usuario')
        if id_usuario is None:
            content_type = request.META.get('CONTENT_TYPE', '')
            if request.body and 'application/json' in content_type:
                try:
                    body = json.loads(request.body)
                    id_usuario = body.get('id_usuario')
                except (json.JSONDecodeError, UnicodeDecodeError):
                    pass
        try:
            return (
                Usuario.objects
                .select_related('rol')
                .get(pk=int(id_usuario), activo=True)
            )
        except (TypeError, ValueError, Usuario.DoesNotExist):
            return None


def get_current_user():
    return _current_user.get()
