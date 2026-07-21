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

        # Un empleado puede tener varios planteles
        planteles = self._resolver_planteles(d)

        anterior = DispositivoFCM.objects.filter(token_fcm=token).first()
        temas_previos = list(anterior.temas) if anterior and anterior.temas else []

        temas_deseados = [push.TEMA_TODOS]
        if rol:
            temas_deseados.append(push.tema_rol(rol))
        for p in planteles:
            temas_deseados.append(push.tema_plantel(p.id_plantel))

        aviso = None
        try:
            temas_vigentes = push.sincronizar(token, temas_deseados, temas_previos)
        except Exception:
            logger.exception('Fallo al sincronizar el token con los temas %s', temas_deseados)
            temas_vigentes = temas_previos
            aviso = 'Registrado, pero la sincronización de temas falló.'

        DispositivoFCM.objects.update_or_create(
            token_fcm=token,
            defaults={
                'usuario': usuario,
                'activo': True,
                'temas': temas_vigentes,
            },
        )

        respuesta = {'ok': True, 'temas': temas_vigentes}
        if aviso:
            respuesta['aviso'] = aviso
        return Response(respuesta, status=status.HTTP_201_CREATED)

    @staticmethod
    def _resolver_planteles(d):
        objetos = {}

        def agregar(pk=None, nombre=None):
            obj = None
            if pk is not None:
                obj = Plantel.objects.filter(pk=pk).first()
            elif nombre:
                obj = Plantel.objects.filter(pk__in=Plantel.equivalentes(nombre)).first()
            if obj:
                objetos.setdefault(obj.id_plantel, obj)

        lista = d.get('planteles')
        if isinstance(lista, list):
            for p in lista:
                if isinstance(p, dict):
                    agregar(pk=p.get('id'), nombre=p.get('nombre'))
                else:
                    agregar(pk=p)

        if not objetos:
            agregar(pk=d.get('plantel_id'), nombre=d.get('plantel_nombre') or d.get('plantel'))

        return list(objetos.values())


def _notif_dict(n):
    return {
        'id': n.id_notificacion,
        'categoria': n.categoria,
        'titulo': n.titulo,
        'mensaje': n.mensaje,
        'plantel': n.plantel.nombre if n.plantel else None,
        'turno': n.turno.nombre_turno if n.turno else None,
        'referencia_id': n.evento_id or n.anuncio_id,
        'personal': n.destinatario_id is not None,
        'leido': n.leido,
        'fecha': n.fecha_creacion.isoformat(),
    }


class NotificacionListView(APIView):
    """Centro de notificaciones (campana). Combina:
    - Masivas: las que le corresponden al usuario según rol/plantel/turno (mismo
      criterio que los anuncios). El estado 'leído' de estas lo gestiona el cliente.
    - Personales: las dirigidas específicamente a él (`destinatario`), con estado
      'leído' persistido en el servidor."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = Notificacion.objects.select_related('plantel', 'turno')
        usuario = _usuario_sesion(request)
        turno_para_todos = Q(turno__isnull=True)
        sin_destinatario = Q(destinatario__isnull=True)

        if usuario:
            rol = usuario.rol.nombre_rol
            if usuario.es_gestor_global():
                nombre_filtro = request.query_params.get('plantel_filtro')
                alcance = usuario.alcance_plantel(plantel_filtro=nombre_filtro)
            elif rol == 'admin':
                alcance = usuario.alcance_plantel()
            else:
                alcance = (
                    usuario.alcance_plantel()
                    & Q(audiencia__in=['todos', rol])
                    & (turno_para_todos | Q(turno_id__in=usuario.ids_turnos()))
                )
            masivas = sin_destinatario & alcance
            qs = qs.filter(Q(destinatario=usuario) | masivas)
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
            qs = qs.filter(sin_destinatario)

        return Response([_notif_dict(n) for n in qs[:50]])


class MarcarNotificacionLeidaView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, id_notificacion=None):
        usuario = _usuario_sesion(request)
        if not usuario:
            return Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)

        pendientes = Notificacion.objects.filter(destinatario=usuario, leido=False)
        if id_notificacion is not None:
            pendientes = pendientes.filter(pk=id_notificacion)

        actualizadas = pendientes.update(leido=True)
        return Response({'ok': True, 'actualizadas': actualizadas}, status=status.HTTP_200_OK)
