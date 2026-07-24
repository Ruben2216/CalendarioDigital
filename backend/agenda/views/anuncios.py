import logging

from django.db.models import Q

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from ._comunes import _usuario_sesion
from ..models import Agrupacion, Anuncio, Notificacion, Plantel, Turno
from ..services import notificaciones_push as push

logger = logging.getLogger(__name__)

AUDIENCIAS_ANUNCIO = {'todos', 'colaborador', 'admin', 'docente', 'alumno'}


def _anuncio_dict(an, usuario):
    agrupacion_data = None
    if an.agrupacion_id:
        agrupacion_data = {
            'id': str(an.agrupacion_id),
            'nombre': an.agrupacion.nombre if an.agrupacion else None,
        }
    return {
        'id': an.id_anuncio,
        'titulo': an.titulo,
        'descripcion': an.descripcion,
        'color': an.color,
        'audiencia': an.audiencia,
        'plantel': an.plantel.nombre if an.plantel else None,
        'turno': an.turno.nombre_turno if an.turno else None,
        'agrupacion': agrupacion_data,
        'fecha': an.fecha_creacion.date().isoformat(),
        'puede_editar': an.puede_editar(usuario),
    }


class AnuncioListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = Anuncio.objects.select_related('plantel', 'turno', 'creado_por__rol', 'agrupacion')
        usuario = _usuario_sesion(request)
        turno_para_todos = Q(turno__isnull=True)

        if usuario:
            rol = usuario.rol.nombre_rol
            propios = Q(creado_por_id=usuario.id_usuario)
            general = Q(plantel__isnull=True, agrupacion__isnull=True)
            if rol == 'superusuario':
                nombre_filtro = request.query_params.get('plantel_filtro')
                cond = general | Q(agrupacion__isnull=False)
                if nombre_filtro:
                    cond |= Q(plantel__nombre=nombre_filtro)
                qs = qs.filter(cond)
            elif rol == 'colaborador':
                nombre_filtro = request.query_params.get('plantel_filtro')
                cond = general | Q(agrupacion__isnull=False)
                if nombre_filtro:
                    cond |= Q(plantel__nombre=nombre_filtro)
                qs = qs.filter(cond & (~Q(audiencia__in=['admin', 'docente']) | propios))
            elif rol == 'admin':
                base_ids = usuario.ids_planteles()
                cond = general | Q(plantel_id__in=base_ids)
                agru_ids = list(
                    Plantel.objects.filter(id_plantel__in=base_ids)
                    .exclude(agrupacion_id=None)
                    .values_list('agrupacion_id', flat=True)
                ) if base_ids else []
                if agru_ids:
                    cond |= Q(agrupacion_id__in=set(agru_ids))
                qs = qs.filter(cond & (~Q(audiencia='colaborador') | propios))
            elif rol == 'director_departamento':
                ids = usuario.ids_planteles_agrupacion_herencia()
                cond = general
                if ids:
                    cond |= Q(plantel_id__in=ids)
                if usuario.agrupacion_id:
                    cond |= Q(agrupacion_id=usuario.agrupacion_id)
                nombre_filtro = request.query_params.get('plantel_filtro')
                if nombre_filtro:
                    cond |= Q(plantel__nombre=nombre_filtro)
                qs = qs.filter(cond & (~Q(audiencia='colaborador') | propios))
            elif rol == 'subdirector_departamento':
                ids = usuario.ids_planteles_agrupacion()
                cond = general
                if ids:
                    cond |= Q(plantel_id__in=ids)
                if usuario.agrupacion_id:
                    cond |= Q(agrupacion_id=usuario.agrupacion_id)
                    if usuario.agrupacion.parent_id:
                        cond |= Q(agrupacion_id=usuario.agrupacion.parent_id)
                nombre_filtro = request.query_params.get('plantel_filtro')
                if nombre_filtro:
                    cond |= Q(plantel__nombre=nombre_filtro)
                qs = qs.filter(cond & (~Q(audiencia='colaborador') | propios))
            else:
                base_ids = usuario.ids_planteles()
                cond = general | Q(plantel_id__in=set(base_ids or []))
                if base_ids:
                    agru_ids = list(
                        Plantel.objects.filter(id_plantel__in=base_ids)
                        .exclude(agrupacion_id=None)
                        .values_list('agrupacion_id', flat=True)
                    )
                    parent_ids = list(
                        Agrupacion.objects.filter(id_agrupacion__in=agru_ids)
                        .exclude(parent_id=None)
                        .values_list('parent_id', flat=True)
                    )
                    all_ids = set(agru_ids) | set(parent_ids)
                    if all_ids:
                        cond |= Q(agrupacion_id__in=all_ids)
                qs = qs.filter(
                    cond
                    & Q(audiencia__in=[Anuncio.AUDIENCIA_TODOS, rol])
                    & (turno_para_todos | Q(turno_id__in=usuario.ids_turnos()))
                )
        else:
            general = Q(plantel__isnull=True, agrupacion__isnull=True)
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
                    & Q(audiencia__in=[Anuncio.AUDIENCIA_TODOS, 'alumno'])
                    & cond_turno
                )
            else:
                qs = qs.filter(general & Q(audiencia=Anuncio.AUDIENCIA_TODOS))

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
        anuncio = Anuncio.objects.select_related('plantel', 'turno', 'creado_por__rol', 'agrupacion').get(pk=anuncio.pk)

        Notificacion.objects.create(
            categoria=Notificacion.CATEGORIA_ANUNCIO,
            titulo=anuncio.titulo,
            mensaje=anuncio.descripcion,
            audiencia=anuncio.audiencia,
            plantel=anuncio.plantel,
            turno=anuncio.turno,
            agrupacion=anuncio.agrupacion,
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
        agrupacion = None

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
        elif rol == 'director_departamento':
            ids = set(usuario.ids_planteles_agrupacion_herencia())
            if not ids:
                return None, 'No tienes planteles en tu agrupación.'
            if not plantel:
                agrupacion = usuario.agrupacion
            else:
                if plantel.id_plantel not in ids:
                    return None, 'Solo puedes publicar anuncios en planteles de tu agrupación.'
                if turno_nombre and turno_nombre.lower() != 'todos':
                    turno = Turno.objects.filter(nombre_turno=turno_nombre).first()
        elif rol == 'subdirector_departamento':
            ids = set(usuario.ids_planteles_agrupacion())
            if not ids:
                return None, 'No tienes planteles en tu agrupación.'
            if not plantel:
                return None, 'Debes seleccionar un plantel de tu agrupación.'
            if plantel.id_plantel not in ids:
                return None, 'Solo puedes publicar anuncios en planteles de tu agrupación.'
            if turno_nombre and turno_nombre.lower() != 'todos':
                turno = Turno.objects.filter(nombre_turno=turno_nombre).first()
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
            'agrupacion': agrupacion,
        }, None


class AnuncioDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def _obtener(self, request, id_anuncio):
        usuario = _usuario_sesion(request)
        try:
            anuncio = Anuncio.objects.select_related('plantel', 'turno', 'creado_por__rol', 'agrupacion').get(pk=id_anuncio)
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
        anuncio = Anuncio.objects.select_related('plantel', 'turno', 'creado_por__rol', 'agrupacion').get(pk=anuncio.pk)
        return Response(_anuncio_dict(anuncio, usuario))

    def delete(self, request, id_anuncio):
        usuario, anuncio = self._obtener(request, id_anuncio)
        if not anuncio:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if not anuncio.puede_editar(usuario):
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        anuncio.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
