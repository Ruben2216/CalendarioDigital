import logging
import threading
from datetime import date as _date, time as _time

from django.db.models import Q

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from ._comunes import _resolver_semestre_grupo, _usuario_sesion
from ..models import (Agrupacion, Calendario, Evento, Grupo, Notificacion, Plantel,
                      TipoEvento, Turno)
from ..services import notificaciones_push as push
from ..services.google_calendar import sincronizar_actualizacion, sincronizar_creacion, sincronizar_eliminacion

logger = logging.getLogger(__name__)


class CalendarioListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        calendarios = Calendario.objects.filter(activo=True)
        return Response([
            {
                'id': c.id_calendario,
                'nombre': c.nombre,
                'clave': c.clave,
                'ciclo': c.ciclo,
                'es_publico': c.es_publico,
            }
            for c in calendarios
        ])


class TipoEventoListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        usuario = _usuario_sesion(request)
        if usuario is None:
            cond = Q(plantel__isnull=True, agrupacion__isnull=True)
            plantel_id = request.query_params.get('plantel_id')
            plantel_nombre = request.query_params.get('plantel')
            if plantel_id:
                cond |= Q(plantel_id=plantel_id)
            elif plantel_nombre:
                cond |= Q(plantel_id__in=Plantel.equivalentes(plantel_nombre))
            else:
                cond |= Q(eventos__publico=True)
            tipos = TipoEvento.objects.select_related('plantel', 'agrupacion').filter(cond).distinct()
        else:
            rol = usuario.rol.nombre_rol
            if rol in ('superusuario', 'colaborador'):
                tipos = TipoEvento.objects.select_related('plantel', 'agrupacion').all()
            elif rol == 'director_departamento':
                ids_plantel = set(usuario.ids_planteles_agrupacion_herencia())
                cond = Q(agrupacion_id=usuario.agrupacion_id) | Q(plantel__isnull=True, agrupacion__isnull=True)
                if ids_plantel:
                    cond |= Q(plantel_id__in=ids_plantel)
                tipos = TipoEvento.objects.select_related('plantel', 'agrupacion').filter(cond)
            elif rol == 'subdirector_departamento':
                ids_plantel = set(usuario.ids_planteles_agrupacion())
                cond = Q(agrupacion_id=usuario.agrupacion_id) | Q(plantel__isnull=True, agrupacion__isnull=True)
                if ids_plantel:
                    cond |= Q(plantel_id__in=ids_plantel)
                tipos = TipoEvento.objects.select_related('plantel', 'agrupacion').filter(cond)
            else:
                tipos = TipoEvento.objects.select_related('plantel', 'agrupacion').filter(
                    Q(plantel__isnull=True, agrupacion__isnull=True) | Q(plantel_id__in=usuario.ids_planteles())
                )

        planteles = set(usuario.ids_planteles()) if usuario and usuario.rol.nombre_rol == 'admin' else set()
        agrupacion_ids = set()
        if usuario and usuario.agrupacion_id:
            if usuario.rol.nombre_rol == 'director_departamento':
                agrupacion_ids.add(usuario.agrupacion_id)
                for sub in usuario.agrupacion.subagrupaciones.all():
                    agrupacion_ids.add(sub.id_agrupacion)
            else:
                agrupacion_ids.add(usuario.agrupacion_id)

        def _puede_editar(t):
            if usuario.rol.nombre_rol in ('superusuario', 'colaborador'):
                return True
            if usuario.rol.nombre_rol == 'admin':
                return t.plantel_id is not None and t.plantel_id in planteles
            if usuario.rol.nombre_rol in ('director_departamento', 'subdirector_departamento'):
                return t.agrupacion_id in agrupacion_ids
            return False

        return Response([
            {'id': str(t.id_tipo_evento), 'etiqueta': t.nombre, 'color': t.color_hex,
             'es_global': t.plantel_id is None and t.agrupacion_id is None,
             'plantel': t.plantel.nombre if t.plantel else None,
             'agrupacion': {'id': str(t.agrupacion.id_agrupacion), 'nombre': t.agrupacion.nombre} if t.agrupacion_id else None,
             'puede_editar': _puede_editar(t)}
            for t in tipos
        ])

    def post(self, request):
        usuario = _usuario_sesion(request)
        if not usuario:
            return Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)
        rol = usuario.rol.nombre_rol
        if rol not in ('admin', 'superusuario', 'colaborador', 'director_departamento', 'subdirector_departamento'):
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        nombre = (request.data.get('nombre') or '').strip()
        color_hex = (request.data.get('color_hex') or '#64748B').strip()
        if not nombre:
            return Response({'error': 'El nombre es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)

        plantel_id = request.data.get('plantel_id')
        plantel = None
        if plantel_id:
            try:
                plantel = Plantel.objects.get(pk=plantel_id)
            except Plantel.DoesNotExist:
                return Response({'error': 'Plantel no encontrado.'}, status=status.HTTP_400_BAD_REQUEST)

        agrupacion = None
        if rol in ('director_departamento', 'subdirector_departamento'):
            agrupacion = usuario.agrupacion
            if plantel_id:
                ids = set(usuario.ids_planteles_agrupacion_herencia() if rol == 'director_departamento' else usuario.ids_planteles_agrupacion())
                if str(plantel_id) not in [str(pid) for pid in ids]:
                    return Response({'error': 'No tienes acceso a ese plantel.'}, status=status.HTTP_403_FORBIDDEN)
        elif usuario.agrupacion_id and usuario.es_gestor_global():
            ids_permitidos = [str(pid) for pid in usuario.ids_planteles_agrupacion_herencia()]
            if plantel_id and str(plantel_id) not in ids_permitidos:
                return Response({'error': 'No tienes acceso a ese plantel.'}, status=status.HTTP_403_FORBIDDEN)
        elif not usuario.es_gestor_global():
            if not plantel_id:
                return Response({'error': 'Plantel inválido.'}, status=status.HTTP_400_BAD_REQUEST)
            ids = [str(pid) for pid in usuario.ids_planteles()]
            if str(plantel_id) not in ids:
                return Response({'error': 'No tienes acceso a ese plantel.'}, status=status.HTTP_403_FORBIDDEN)

        tipo = TipoEvento.objects.create(nombre=nombre, color_hex=color_hex, plantel=plantel, agrupacion=agrupacion)
        return Response(
            {'id': str(tipo.id_tipo_evento), 'etiqueta': tipo.nombre, 'color': tipo.color_hex,
             'es_global': tipo.plantel_id is None and tipo.agrupacion_id is None,
             'plantel': tipo.plantel.nombre if tipo.plantel else None,
             'agrupacion': {'id': str(tipo.agrupacion.id_agrupacion), 'nombre': tipo.agrupacion.nombre} if tipo.agrupacion_id else None,
             'puede_editar': True},
            status=status.HTTP_201_CREATED,
        )


class TipoEventoDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def _obtener_autorizado(self, request, id_tipo):
        usuario = _usuario_sesion(request)
        if not usuario:
            return None, None, Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            tipo = TipoEvento.objects.select_related('plantel').get(pk=id_tipo)
        except TipoEvento.DoesNotExist:
            return None, None, Response(status=status.HTTP_404_NOT_FOUND)

        rol = usuario.rol.nombre_rol
        if rol in ('superusuario', 'colaborador'):
            return usuario, tipo, None
        if rol == 'admin':
            if tipo.plantel_id is None:
                return None, None, Response(
                    {'error': 'No puedes modificar tipos de evento globales.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            if tipo.plantel_id not in usuario.ids_planteles():
                return None, None, Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
            return usuario, tipo, None
        if rol in ('director_departamento', 'subdirector_departamento'):
            if tipo.agrupacion_id != usuario.agrupacion_id:
                return None, None, Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
            return usuario, tipo, None
        return None, None, Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

    def put(self, request, id_tipo):
        usuario, tipo, err = self._obtener_autorizado(request, id_tipo)
        if err:
            return err
        nombre = (request.data.get('nombre') or '').strip()
        color_hex = (request.data.get('color_hex') or '').strip()
        if nombre:
            tipo.nombre = nombre
        if color_hex:
            tipo.color_hex = color_hex
        tipo.save()
        return Response({'id': str(tipo.id_tipo_evento), 'etiqueta': tipo.nombre, 'color': tipo.color_hex,
                         'es_global': tipo.plantel_id is None})

    def delete(self, request, id_tipo):
        usuario, tipo, err = self._obtener_autorizado(request, id_tipo)
        if err:
            return err
        tipo.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _evento_dict(ev, usuario):
    return {
        'id': ev.id_evento,
        'titulo': ev.titulo,
        'tipo': str(ev.tipo_evento_id),
        'area': ev.area or '',
        'fecha': ev.fecha_inicio.isoformat(),
        'fechaFin': ev.fecha_fin.isoformat() if ev.fecha_fin else None,
        'horaInicio': ev.hora_inicio.strftime('%H:%M') if ev.hora_inicio else '',
        'horaFin': ev.hora_fin.strftime('%H:%M') if ev.hora_fin else '',
        'lugar': ev.lugar or '',
        'formato': 'punto' if ev.hora_inicio else 'rango',
        'semestre': ev.semestre_id,
        'grupo': ev.grupo.letra_id if ev.grupo else None,
        'plantel': ev.plantel.nombre if ev.plantel else None,
        'agrupacion': {
            'id': str(ev.agrupacion_id),
            'nombre': ev.agrupacion.nombre,
        } if ev.agrupacion_id else None,
        'turno': ev.turno.nombre_turno if ev.turno else None,
        'id_calendario': ev.calendario_id,
        'publico': ev.publico,
        'puede_editar': ev.puede_editar(usuario),
    }


def _parse_fecha(valor):
    if not valor:
        return None
    try:
        return _date.fromisoformat(valor[:10])
    except (ValueError, TypeError):
        return None


def _parse_hora(valor):
    if not valor:
        return None
    try:
        horas, minutos = map(int, valor.split(':')[:2])
        return _time(horas, minutos)
    except (ValueError, TypeError, AttributeError):
        return None


_DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
          'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']


def _hora_12h(t):
    h12 = t.hour % 12 or 12
    return f"{h12}:{t.minute:02d} {'AM' if t.hour < 12 else 'PM'}"


def _texto_evento(evento):
    f = evento.fecha_inicio
    fecha = f"{_DIAS_SEMANA[f.weekday()]} {f.day} de {_MESES[f.month - 1]} de {f.year}"
    if evento.fecha_fin and evento.fecha_fin != f:
        ff = evento.fecha_fin
        fecha += f" al {ff.day} de {_MESES[ff.month - 1]}"
    lineas = [f"Fecha: {fecha}"]

    if evento.hora_inicio:
        horas = _hora_12h(evento.hora_inicio)
        if evento.hora_fin:
            horas += f" - {_hora_12h(evento.hora_fin)}"
        lineas.append(f"Hora: {horas}")
    else:
        lineas.append("Hora: Todo el día")

    if evento.lugar:
        lineas.append(f"Lugar: {evento.lugar}")

    if evento.area:
        lineas.append(f"Área: {evento.area}")

    return "\n".join(lineas)


def _notificar_evento(evento, accion):
    etiquetas = {
        'creado': 'Nuevo evento',
        'actualizado': 'Evento actualizado',
        'eliminado': 'Evento cancelado',
    }
    titulo = f"{etiquetas.get(accion, 'Evento')}: {evento.titulo}"
    mensaje = _texto_evento(evento)

    Notificacion.objects.create(
        categoria=Notificacion.CATEGORIA_EVENTO,
        titulo=titulo,
        mensaje=mensaje,
        audiencia='todos',
        plantel=evento.plantel,
        turno=evento.turno,
        evento=evento if accion != 'eliminado' else None,
    )

    temas = [push.tema_plantel(evento.plantel_id)] if evento.plantel_id else [push.TEMA_TODOS]
    try:
        push.enviar_a_temas(temas, titulo, mensaje, {
            'tipo': f'evento_{accion}',
            'id_evento': evento.id_evento,
            'url': '/ir/calendario',
        })
    except Exception:
        logger.exception('Fallo al enviar push del evento %s', evento.id_evento)


class EventoListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        id_calendario = request.query_params.get('id_calendario')
        try:
            calendario = Calendario.objects.get(pk=int(id_calendario), activo=True)
        except (TypeError, ValueError, Calendario.DoesNotExist):
            return Response({'error': 'Calendario no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        qs = Evento.objects.filter(calendario=calendario).select_related(
            'tipo_evento', 'plantel', 'turno', 'creado_por__rol', 'semestre', 'grupo__letra', 'agrupacion'
        )
        usuario = _usuario_sesion(request)
        turno_para_todos = Q(turno__isnull=True)

        if usuario:
            rol = usuario.rol.nombre_rol
            if usuario.es_gestor_global():
                nombre_filtro = request.query_params.get('plantel_filtro')
                if usuario.agrupacion_id:
                    if rol == 'director_departamento':
                        q = Q(plantel__isnull=True, agrupacion__isnull=True)
                        q |= Q(agrupacion_id=usuario.agrupacion_id)
                        q |= Q(agrupacion__parent_id=usuario.agrupacion_id)
                        if nombre_filtro:
                            q |= Q(plantel__nombre=nombre_filtro)
                    else:
                        q = Q(plantel__isnull=True, agrupacion__isnull=True)
                        if nombre_filtro:
                            q |= Q(plantel__nombre=nombre_filtro)
                        q |= Q(agrupacion_id=usuario.agrupacion_id)
                else:
                    q = usuario.alcance_plantel(plantel_filtro=nombre_filtro)
                qs = qs.filter(q)
            elif rol == 'admin':
                q = Q(plantel__isnull=True, agrupacion__isnull=True)
                base_ids = usuario.ids_planteles()
                if base_ids:
                    q |= Q(plantel_id__in=base_ids)
                qs = qs.filter(q)
            else:
                cond_turno = turno_para_todos | Q(turno_id__in=usuario.ids_turnos())
                q = Q(plantel__isnull=True, agrupacion__isnull=True)
                base_ids = usuario.ids_planteles_agrupacion() or usuario.ids_planteles()
                if base_ids:
                    q |= Q(plantel_id__in=base_ids)
                qs = qs.filter(q & cond_turno)
        else:
            plantel_para_todos = Q(plantel__isnull=True, agrupacion__isnull=True)
            rol = request.query_params.get('rol')
            plantel_id_param = request.query_params.get('plantel_id')
            plantel_nombre = request.query_params.get('plantel')
            turno_nombre = request.query_params.get('turno')
            semestre_param = request.query_params.get('semestre')
            grupo_param = (request.query_params.get('grupo') or '').strip().upper()

            if rol == 'alumno' and (plantel_id_param or plantel_nombre):
                if plantel_id_param:
                    cond_plantel = plantel_para_todos | Q(plantel_id=plantel_id_param)
                else:
                    ids = Plantel.equivalentes(plantel_nombre)
                    cond_plantel = plantel_para_todos | Q(plantel_id__in=ids)

                cond_turno = turno_para_todos
                if turno_nombre:
                    cond_turno = turno_para_todos | Q(turno__nombre_turno=turno_nombre)

                cond_semestre = Q(semestre__isnull=True)
                if semestre_param:
                    try:
                        cond_semestre |= Q(semestre_id=int(semestre_param))
                    except (ValueError, TypeError):
                        pass

                cond_grupo = Q(grupo__isnull=True)
                if grupo_param and semestre_param:
                    try:
                        grp = Grupo.objects.filter(
                            semestre_id=int(semestre_param), letra_id=grupo_param
                        ).first()
                        if grp:
                            cond_grupo |= Q(grupo_id=grp.id_grupo)
                    except (ValueError, TypeError):
                        pass

                qs = qs.filter(cond_plantel & cond_turno & cond_semestre & cond_grupo)
            else:
                if not calendario.es_publico:
                    return Response([])

                qs = qs.filter(publico=True)

        return Response([_evento_dict(ev, usuario) for ev in qs])

    def post(self, request):
        usuario = _usuario_sesion(request)
        if not usuario:
            return Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)

        rol = usuario.rol.nombre_rol
        if rol not in ('admin', 'subdirector_departamento') and not usuario.es_gestor_global():
            return Response({'error': 'No autorizado para crear eventos.'}, status=status.HTTP_403_FORBIDDEN)

        datos, error = self._leer_evento(request, usuario, rol)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)

        evento = Evento.objects.create(creado_por=usuario, **datos)
        evento = Evento.objects.select_related('tipo_evento', 'plantel', 'turno', 'creado_por__rol', 'semestre', 'grupo__letra', 'agrupacion').get(pk=evento.pk)
        _notificar_evento(evento, 'creado')
        agregar_google = request.data.get('agregar_a_google_calendar', True)
        excluir = set() if agregar_google else {usuario.id_usuario}
        threading.Thread(target=sincronizar_creacion, args=(evento, excluir), daemon=True).start()
        return Response(_evento_dict(evento, usuario), status=status.HTTP_201_CREATED)

    @staticmethod
    def _leer_evento(request, usuario, rol):
        d = request.data
        try:
            calendario = Calendario.objects.get(pk=int(d.get('id_calendario')), activo=True)
        except (TypeError, ValueError, Calendario.DoesNotExist):
            return None, 'Calendario no encontrado.'
        try:
            tipo = TipoEvento.objects.select_related('plantel').get(pk=int(d.get('tipo')))
        except (TypeError, ValueError, TipoEvento.DoesNotExist):
            return None, 'Tipo de evento inválido.'

        titulo = (d.get('titulo') or '').strip() or tipo.nombre
        fecha_inicio = _parse_fecha(d.get('fecha'))
        if not fecha_inicio:
            return None, 'La fecha es obligatoria.'

        plantel = Plantel.objects.filter(nombre=d.get('plantel')).first() if d.get('plantel') else None
        turno = Turno.objects.filter(nombre_turno=d.get('turno')).first() if d.get('turno') else None

        agrupacion = None
        if d.get('agrupacion'):
            try:
                agrupacion = Agrupacion.objects.get(pk=d['agrupacion'])
            except (Agrupacion.DoesNotExist, ValueError):
                return None, 'Agrupación inválida.'

        semestre_obj, grupo_obj = _resolver_semestre_grupo(d.get('semestre'), d.get('grupo'))

        if usuario.agrupacion_id and rol == 'director_departamento':
            ids_permitidos = usuario.ids_planteles_agrupacion_herencia()
        elif usuario.agrupacion_id:
            ids_permitidos = usuario.ids_planteles_agrupacion()
        else:
            ids_permitidos = usuario.ids_planteles()
        if ids_permitidos:
            if plantel:
                if plantel.id_plantel not in ids_permitidos:
                    return None, 'No tienes permiso para crear eventos en este plantel.'
            if agrupacion and agrupacion.id_agrupacion != usuario.agrupacion_id:
                return None, 'No tienes permiso para crear eventos en esta agrupación.'
            if tipo.plantel_id is not None and tipo.plantel_id not in ids_permitidos:
                return None, 'El tipo de evento no pertenece a tu catálogo de plantel.'
            if tipo.agrupacion_id and tipo.agrupacion_id != usuario.agrupacion_id:
                return None, 'El tipo de evento no pertenece a tu catálogo.'
        elif rol == 'admin':
            if calendario.clave != Calendario.CLAVE_ESCOLARIZADO:
                return None, 'Solo puedes crear eventos en el calendario escolarizado.'
            if not plantel:
                return None, 'Debes seleccionar tu plantel.'
            asignaciones = list(usuario.planteles_asignados.select_related('plantel', 'turno').all())
            par_valido = next(
                (a for a in asignaciones if a.plantel_id == plantel.id_plantel), None
            )
            if not par_valido:
                return None, 'Solo puedes crear eventos en tu plantel asignado.'
            ids_plantel = [a.plantel_id for a in asignaciones]
            if tipo.plantel_id is not None and tipo.plantel_id not in ids_plantel:
                return None, 'El tipo de evento no pertenece a tu catálogo de plantel.'

        datos = {
            'calendario': calendario,
            'tipo_evento': tipo,
            'titulo': titulo,
            'area': (d.get('area') or '').strip(),
            'fecha_inicio': fecha_inicio,
            'fecha_fin': _parse_fecha(d.get('fechaFin')),
            'hora_inicio': _parse_hora(d.get('horaInicio')),
            'hora_fin': _parse_hora(d.get('horaFin')),
            'lugar': (d.get('lugar') or '').strip(),
            'plantel': plantel,
            'agrupacion': agrupacion,
            'turno': turno,
            'semestre': semestre_obj,
            'grupo': grupo_obj,
        }

        if usuario.rol.nombre_rol in ('superusuario', 'colaborador'):
            datos['publico'] = True if d.get('publico') else None
        return datos, None


class EventoDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def _obtener(self, request, id_evento):
        usuario = _usuario_sesion(request)
        try:
            evento = Evento.objects.select_related(
                'tipo_evento', 'plantel', 'turno', 'creado_por__rol', 'calendario',
                'semestre', 'grupo__letra', 'agrupacion'
            ).get(pk=id_evento)
        except Evento.DoesNotExist:
            return None, None
        return usuario, evento

    def put(self, request, id_evento):
        usuario, evento = self._obtener(request, id_evento)
        if not evento:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if not evento.puede_editar(usuario):
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        datos, error = EventoListView._leer_evento(request, usuario, usuario.rol.nombre_rol)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)

        for campo, valor in datos.items():
            setattr(evento, campo, valor)
        evento.save()
        evento = Evento.objects.select_related('tipo_evento', 'plantel', 'turno', 'creado_por__rol', 'semestre', 'grupo__letra', 'agrupacion').get(pk=evento.pk)
        _notificar_evento(evento, 'actualizado')
        threading.Thread(target=sincronizar_actualizacion, args=(evento,), daemon=True).start()
        return Response(_evento_dict(evento, usuario))

    def delete(self, request, id_evento):
        usuario, evento = self._obtener(request, id_evento)
        if not evento:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if not evento.puede_editar(usuario):
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        _notificar_evento(evento, 'eliminado')
        sincronizar_eliminacion(evento)   # antes de evento.delete(): lee los syncs
        evento.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
