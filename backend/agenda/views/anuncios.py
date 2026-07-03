import logging

from django.db.models import Q

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from ._comunes import _usuario_sesion
from ..models import Anuncio, Notificacion, Plantel, Turno
from ..services import notificaciones_push as push

logger = logging.getLogger(__name__)

AUDIENCIAS_ANUNCIO = {'todos', 'colaborador', 'admin', 'docente', 'alumno'}


def _anuncio_dict(an, usuario):
    return {
        'id': an.id_anuncio,
        'titulo': an.titulo,
        'descripcion': an.descripcion,
        'color': an.color,
        'audiencia': an.audiencia,
        'plantel': an.plantel.nombre if an.plantel else None,
        'turno': an.turno.nombre_turno if an.turno else None,
        'fecha': an.fecha_creacion.date().isoformat(),
        'puede_editar': an.puede_editar(usuario),
    }


class AnuncioListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = Anuncio.objects.select_related('plantel', 'turno', 'creado_por__rol')
        usuario = _usuario_sesion(request)
        turno_para_todos = Q(turno__isnull=True)

        if usuario:
            rol = usuario.rol.nombre_rol
            if usuario.es_gestor_global():
                # Lo mismo que calendario por defecto solo anuncios generales; con plantel_filtro añade los
                # de ese plantel
                nombre_filtro = request.query_params.get('plantel_filtro')
                qs = qs.filter(usuario.alcance_plantel(plantel_filtro=nombre_filtro))
            elif rol == 'admin':
                qs = qs.filter(usuario.alcance_plantel())
            else:
                qs = qs.filter(
                    usuario.alcance_plantel()
                    & Q(audiencia__in=[Anuncio.AUDIENCIA_TODOS, rol])
                    & (turno_para_todos | Q(turno_id__in=usuario.ids_turnos()))
                )
        else:
            plantel_para_todos = Q(plantel__isnull=True)
            rol = request.query_params.get('rol')
            plantel_nombre = request.query_params.get('plantel')
            turno_nombre = request.query_params.get('turno')
            if rol == 'alumno' and plantel_nombre:
                ids = Plantel.equivalentes(plantel_nombre)
                cond_turno = turno_para_todos
                if turno_nombre:
                    cond_turno = turno_para_todos | Q(turno__nombre_turno=turno_nombre)
                qs = qs.filter(
                    (plantel_para_todos | Q(plantel_id__in=ids))
                    & Q(audiencia__in=[Anuncio.AUDIENCIA_TODOS, 'alumno'])
                    & cond_turno
                )
            else:
                qs = qs.filter(plantel_para_todos & Q(audiencia=Anuncio.AUDIENCIA_TODOS))

        return Response([_anuncio_dict(a, usuario) for a in qs])

    def post(self, request):
        usuario = _usuario_sesion(request)
        if not usuario:
            return Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)

        rol = usuario.rol.nombre_rol
        if rol != 'admin' and not usuario.es_gestor_global():
            return Response({'error': 'No autorizado para crear anuncios.'}, status=status.HTTP_403_FORBIDDEN)

        datos, error = self._leer_anuncio(request, usuario, rol)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)

        anuncio = Anuncio.objects.create(creado_por=usuario, **datos)
        anuncio = Anuncio.objects.select_related('plantel', 'turno', 'creado_por__rol').get(pk=anuncio.pk)

        Notificacion.objects.create(
            categoria=Notificacion.CATEGORIA_ANUNCIO,
            titulo=anuncio.titulo,
            mensaje=anuncio.descripcion,
            audiencia=anuncio.audiencia,
            plantel=anuncio.plantel,
            turno=anuncio.turno,
            anuncio=anuncio,
        )

        try:
            push.enviar_anuncio(anuncio)
        except Exception:
            logger.exception('Fallo al enviar push del anuncio %s', anuncio.id_anuncio)

        return Response(_anuncio_dict(anuncio, usuario), status=status.HTTP_201_CREATED)

    @staticmethod
    def _leer_anuncio(request, usuario, rol):
        d = request.data
        titulo = (d.get('titulo') or '').strip()
        descripcion = (d.get('descripcion') or '').strip()
        if not titulo or not descripcion:
            return None, 'Título y descripción son obligatorios.'

        audiencia = (d.get('audiencia') or Anuncio.AUDIENCIA_TODOS).strip()
        if audiencia not in AUDIENCIAS_ANUNCIO:
            return None, 'Audiencia inválida.'

        color = (d.get('color') or 'azul').strip()
        plantel = Plantel.objects.filter(nombre=d.get('plantel')).first() if d.get('plantel') else None

        turno_nombre = (d.get('turno') or '').strip()
        turno = None

        if rol == 'admin':
            # El admin no crea anuncios generales: se fuerza a su plantel asignado
            asignaciones = list(usuario.planteles_asignados.select_related('plantel', 'turno').all())
            if not plantel:
                return None, 'Debes seleccionar tu plantel.'
            if not any(a.plantel_id == plantel.id_plantel for a in asignaciones):
                return None, 'Solo puedes publicar anuncios en tu plantel asignado.'
            mis_turnos = {a.turno.nombre_turno: a.turno for a in asignaciones
                          if a.plantel_id == plantel.id_plantel}
            if turno_nombre:
                if turno_nombre not in mis_turnos:
                    return None, 'Solo puedes publicar en tu turno asignado.'
                turno = mis_turnos[turno_nombre]
            elif len(mis_turnos) == 1:
                turno = next(iter(mis_turnos.values()))
            else:
                return None, 'Debes seleccionar el turno.'
        else:
            if turno_nombre and turno_nombre.lower() != 'todos':
                turno = Turno.objects.filter(nombre_turno=turno_nombre).first()
                if not turno:
                    return None, 'Turno inválido.'

        return {
            'titulo': titulo,
            'descripcion': descripcion,
            'audiencia': audiencia,
            'color': color,
            'plantel': plantel,
            'turno': turno,
        }, None


class AnuncioDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def _obtener(self, request, id_anuncio):
        usuario = _usuario_sesion(request)
        try:
            anuncio = Anuncio.objects.select_related('plantel', 'turno', 'creado_por__rol').get(pk=id_anuncio)
        except Anuncio.DoesNotExist:
            return usuario, None
        return usuario, anuncio

    def put(self, request, id_anuncio):
        usuario, anuncio = self._obtener(request, id_anuncio)
        if not anuncio:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if not anuncio.puede_editar(usuario):
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        datos, error = AnuncioListView._leer_anuncio(request, usuario, usuario.rol.nombre_rol)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)

        for campo, valor in datos.items():
            setattr(anuncio, campo, valor)
        anuncio.save()
        anuncio = Anuncio.objects.select_related('plantel', 'turno', 'creado_por__rol').get(pk=anuncio.pk)
        return Response(_anuncio_dict(anuncio, usuario))

    def delete(self, request, id_anuncio):
        usuario, anuncio = self._obtener(request, id_anuncio)
        if not anuncio:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if not anuncio.puede_editar(usuario):
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        anuncio.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
