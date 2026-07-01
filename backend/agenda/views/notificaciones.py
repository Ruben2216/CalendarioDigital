import logging

from django.db.models import Q

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from ._comunes import _usuario_sesion
from ..models import DispositivoFCM, Notificacion, Plantel, Usuario
from ..services import notificaciones_push as push

logger = logging.getLogger(__name__)


class RegistrarDispositivoView(APIView):
    """Registra (o actualiza) el token FCM de un dispositivo y lo suscribe
    a sus temas: tema_todos, tema_rol_{rol} y, si se conoce, tema_plantel_{id}.

    Acepta el plantel por id (`plantel_id`) o por nombre (`plantel_nombre` /
    `plantel`). El nombre se resuelve con Plantel.equivalentes para cubrir
    a los alumnos, cuyo plantel llega sin id desde la API institucional.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        d = request.data
        token = (d.get('token_fcm') or '').strip()
        if not token:
            return Response({'error': 'token_fcm requerido.'}, status=status.HTTP_400_BAD_REQUEST)

        rol = (d.get('rol') or '').strip()

        # Los empleados tienen pk numérico en la BD local; los alumnos llegan
        # con un id externo (GUID/matrícula) que NO existe como Usuario local.
        usuario = None
        id_usuario = d.get('id_usuario')
        if id_usuario is not None and str(id_usuario).isdigit():
            usuario = Usuario.objects.filter(pk=int(id_usuario), activo=True).first()

        plantel = None
        plantel_id = d.get('plantel_id')
        plantel_nombre = d.get('plantel_nombre') or d.get('plantel')
        if plantel_id is not None:
            plantel = Plantel.objects.filter(pk=plantel_id).first()
        elif plantel_nombre:
            ids = Plantel.equivalentes(plantel_nombre)
            plantel = Plantel.objects.filter(pk__in=ids).first()

        DispositivoFCM.objects.update_or_create(
            token_fcm=token,
            defaults={
                'usuario': usuario,
                'plantel': plantel,
                'activo': True,
            },
        )

        temas = [push.TEMA_TODOS]
        if rol:
            temas.append(push.tema_rol(rol))
        if plantel:
            temas.append(push.tema_plantel(plantel.id_plantel))

        try:
            push.suscribir(token, temas)
        except Exception:
            logger.exception('Fallo al suscribir el token a los temas %s', temas)
            return Response(
                {'ok': True, 'temas': temas, 'aviso': 'Registrado, pero la suscripción a temas falló.'},
                status=status.HTTP_201_CREATED,
            )

        return Response({'ok': True, 'temas': temas}, status=status.HTTP_201_CREATED)


def _notif_dict(n):
    return {
        'id': n.id_notificacion,
        'categoria': n.categoria,
        'titulo': n.titulo,
        'mensaje': n.mensaje,
        'plantel': n.plantel.nombre if n.plantel else None,
        'turno': n.turno.nombre_turno if n.turno else None,
        'referencia_id': n.evento_id or n.anuncio_id,
        'fecha': n.fecha_creacion.isoformat(),
    }


class NotificacionListView(APIView):
    """Centro de notificaciones (campana). Devuelve las notificaciones que le
    corresponden al usuario según su rol y plantel, con el mismo criterio que
    los anuncios. El estado 'leído' se gestiona en el cliente."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = Notificacion.objects.select_related('plantel', 'turno')
        usuario = _usuario_sesion(request)
        turno_para_todos = Q(turno__isnull=True)

        if usuario:
            rol = usuario.rol.nombre_rol
            if rol == 'superusuario':
                nombre_filtro = request.query_params.get('plantel_filtro')
                qs = qs.filter(usuario.alcance_plantel(plantel_filtro=nombre_filtro))
            elif rol == 'admin':
                qs = qs.filter(usuario.alcance_plantel())
            else:
                qs = qs.filter(
                    usuario.alcance_plantel()
                    & Q(audiencia__in=['todos', rol])
                    & (turno_para_todos | Q(turno_id__in=usuario.ids_turnos()))
                )
        else:
            general = Q(plantel__isnull=True)
            rol = request.query_params.get('rol')
            plantel_nombre = request.query_params.get('plantel')
            turno_nombre = request.query_params.get('turno')
            if rol == 'alumno' and plantel_nombre:
                ids = Plantel.equivalentes(plantel_nombre)
                cond_turno = turno_para_todos
                if turno_nombre:
                    cond_turno = turno_para_todos | Q(turno__nombre_turno=turno_nombre)
                qs = qs.filter(
                    (general | Q(plantel_id__in=ids))
                    & Q(audiencia__in=['todos', 'alumno'])
                    & cond_turno
                )
            else:
                qs = qs.filter(general & Q(audiencia='todos'))

        return Response([_notif_dict(n) for n in qs[:50]])
