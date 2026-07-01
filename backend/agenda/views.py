from django.shortcuts import redirect
from django.conf import settings
from django.utils import timezone

import requests

from django.db.models import Q, Exists, OuterRef

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from .serializers import LoginInstitucionalSerializer
from .services.mock_institucional import (
    mock_login_empleado,
    login_alumno,
    obtener_datos_por_correo,
    es_alumno,
)
import re
from datetime import date as _date, time as _time, timedelta

from .models import (
    Usuario, Rol, Conversacion, Mensaje, LecturaMensaje, SolicitudAdmin,
    UsuarioPlantel, Plantel, Turno, Calendario, TipoEvento, Evento, Anuncio,
    DispositivoFCM, Notificacion, GoogleOauthCredential, EventoGoogleSync,
    Semestre, Letra, Grupo,
)
from .services.google_calendar import (
    sincronizar_creacion,
    sincronizar_actualizacion,
    sincronizar_eliminacion,
    backfill_usuario,
)
from .services import notificaciones_push as push

import logging
import threading

logger = logging.getLogger(__name__)

ROLES_EMPLEADO = {'superusuario', 'admin', 'docente'}

_TURNOS_ALUMNO = {'M': 'Matutino', 'V': 'Vespertino'}


def _qr_data_uri(qr: str) -> str:
    if not qr:
        return ''
    if qr.startswith('data:'):
        return qr
    return f'data:image/png;base64,{qr}'


class LoginInstitucionalView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginInstitucionalSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'error': 'Datos inválidos.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user_name = serializer.validated_data['userName']
        password = serializer.validated_data['password']
        rol_solicitado = serializer.validated_data['rol']

        # El alumno se autentica directamente contra la API institucional
        # (usuario = CURP, password = matrícula) y sus datos provienen de ahí
        if rol_solicitado == 'alumno':
            return self._login_alumno(user_name, password)

        usuario_local = None
        if rol_solicitado in ('admin', 'superusuario', 'personal', 'docente'):
            try:
                usuario_local = Usuario.objects.get(correo=user_name, activo=True)
            except Usuario.DoesNotExist:
                pass

        if usuario_local and usuario_local.password_mock and usuario_local.password_mock == password:
            credenciales_validas = True
            id_externo = usuario_local.correo
            respuesta_institucional = {'token': f'local-{usuario_local.id_usuario}', 'foto': '', 'qr': ''}
        else:
            respuesta_institucional = mock_login_empleado(user_name, password)
            credenciales_validas = respuesta_institucional.get('statusLogueo') is True
            id_externo = respuesta_institucional.get('correoInstitucional', '')

        if not credenciales_validas:
            return Response(
                {'error': 'Credenciales incorrectas.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        try:
            rol_obj, _ = Rol.objects.get_or_create(nombre_rol='docente')
            usuario, creado = Usuario.objects.get_or_create(
                correo=id_externo,
                defaults={
                    'rol': rol_obj,
                    'nombre': respuesta_institucional.get('empleado') or '',
                    'activo': True,
                },
            )
            if not creado:
                nombre_api = respuesta_institucional.get('empleado') or ''
                if nombre_api and usuario.nombre != nombre_api:
                    Usuario.objects.filter(pk=usuario.pk).update(nombre=nombre_api)
            usuario = (
                Usuario.objects
                .select_related('rol')
                .prefetch_related('planteles_asignados__plantel', 'planteles_asignados__turno')
                .get(pk=usuario.pk, activo=True)
            )
        except Usuario.DoesNotExist:
            return Response(
                {'error': 'Usuario no registrado en el sistema.'},
                status=status.HTTP_404_NOT_FOUND
            )

        rol_real = usuario.rol.nombre_rol
        if rol_solicitado != 'personal':
            rol_compatible = rol_real == rol_solicitado or (
                rol_solicitado == 'admin' and rol_real == 'superusuario'
            )
            if not rol_compatible:
                return Response(
                    {'error': 'El perfil seleccionado no corresponde a tu cuenta.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        datos_empleado = {}
        if rol_solicitado != 'alumno' and id_externo:
            datos_empleado = obtener_datos_por_correo(id_externo)
            id_api_value = str(datos_empleado['id']) if datos_empleado.get('id') is not None else None
            if id_api_value and usuario.id_api != id_api_value:
                Usuario.objects.filter(pk=usuario.pk).update(id_api=id_api_value)

        # Sincronizar plantel desde adscripción institucional (solo empleados via API, no admins locales)
        if not usuario_local and datos_empleado:
            adscripcion_nombre = (
                datos_empleado.get('adscripcion') or
                datos_empleado.get('nombreAdscripcion') or ''
            ).strip()
            if adscripcion_nombre:
                plantel_adscripcion = Plantel.objects.filter(nombre__iexact=adscripcion_nombre).first()
                if plantel_adscripcion:
                    turno_default, _ = Turno.objects.get_or_create(nombre_turno='Matutino')
                    UsuarioPlantel.objects.get_or_create(
                        usuario=usuario,
                        plantel=plantel_adscripcion,
                        defaults={'turno': turno_default},
                    )
                    usuario = (
                        Usuario.objects
                        .select_related('rol')
                        .prefetch_related('planteles_asignados__plantel', 'planteles_asignados__turno')
                        .get(pk=usuario.pk)
                    )

        return Response({
            'token': respuesta_institucional.get('token', ''),
            'nombre': usuario.nombre or '',
            'foto': respuesta_institucional.get('foto', ''),
            'qr': respuesta_institucional.get('qr', ''),
            'sesion': {
                'id_usuario': usuario.id_usuario,
                'rol': usuario.rol.nombre_rol,
                'correo': usuario.correo or '',
                'planteles': [
                    {
                        'plantel': {
                            'id': up.plantel.id_plantel,
                            'nombre': up.plantel.nombre,
                        },
                        'turno': {
                            'id': up.turno.id_turno,
                            'nombre': up.turno.nombre_turno,
                        }
                    }
                    for up in usuario.planteles_asignados.all()
                ],
                'tipoEmpleado': datos_empleado.get('tipoEmpleado', ''),
                'adscripcion': datos_empleado.get('adscripcion', '') or datos_empleado.get('nombreAdscripcion', ''),
            },
        }, status=status.HTTP_200_OK)

    def _login_alumno(self, usuario, password):
        """Login de alumno contra la API institucional (CURP + matrícula).

        Los datos del alumno (nombre, plantel, turno, grupo, etc.) provienen
        íntegramente de la respuesta de la API; no se consulta la BD local.
        """
        datos = login_alumno(usuario, password)
        if datos.get('estatusLogin') != 1:
            return Response(
                {'error': 'Credenciales incorrectas.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        codigo_turno = (datos.get('turno') or '').strip().upper()
        clave_plantel = (datos.get('clavePlantel') or '').strip()
        plantel_local = Plantel.objects.filter(clave=clave_plantel).first() if clave_plantel else None
        return Response({
            'token': datos.get('token', ''),
            'nombre': datos.get('nombres') or '',
            'foto': datos.get('foto', '') or '',
            'qr': _qr_data_uri(datos.get('qr', '')),
            'sesion': {
                'id_usuario': datos.get('idAlumno'),
                'rol': 'alumno',
                'matricula': datos.get('matricula'),
                'curp': datos.get('curp'),
                'plantel': {
                    'id': str(plantel_local.id_plantel) if plantel_local else None,
                    'nombre': plantel_local.nombre if plantel_local else datos.get('plantel'),
                    'clave': clave_plantel or None,
                },
                'turno': {
                    'id': None,
                    'nombre': _TURNOS_ALUMNO.get(codigo_turno, datos.get('turno')),
                },
                'grupo': datos.get('grupo'),
                'semestre': datos.get('semestre'),
            },
        }, status=status.HTTP_200_OK)


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


class DocentesListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        usuario = _usuario_sesion(request)
        if not usuario:
            return Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)

        if usuario.rol.nombre_rol == 'superusuario':
            docentes = Usuario.objects.filter(rol__nombre_rol='docente', activo=True)
        else:
            planteles_ids = usuario.planteles_asignados.values_list('plantel_id', flat=True)
            docentes = Usuario.objects.filter(
                rol__nombre_rol='docente', planteles_asignados__plantel_id__in=planteles_ids, activo=True
            ).distinct()

        docentes = docentes.select_related('rol').prefetch_related('planteles_asignados__turno')
        return Response([{
            'id': d.id_usuario,
            'nombre': d.nombre or d.correo,
            'correo': d.correo,
            'turnos': list(set(up.turno.nombre_turno for up in d.planteles_asignados.all())),
        } for d in docentes])


class ConversacionListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        usuario = _usuario_sesion(request)
        if not usuario:
            return Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)

        rol = usuario.rol.nombre_rol
        if rol == 'superusuario':
            # El superusuario conserva visibilidad total (QUITAR A FUTURO)
            convs = Conversacion.objects.filter(activa=True)
        else:
            convs = Conversacion.objects.filter(activa=True).filter(
                Q(participante_a=usuario) | Q(participante_b=usuario)
            )

        convs = convs.select_related(
            'participante_a__rol', 'participante_b__rol', 'plantel'
        ).prefetch_related('lecturas', 'mensajes')

        resultado = []
        for conv in convs:
            ultimo = conv.mensajes.filter(eliminado=False).last()
            lectura = conv.lecturas.filter(usuario=usuario).first()
            sin_leer = conv.mensajes.filter(
                eliminado=False,
                pk__gt=lectura.ultimo_leido_id if lectura and lectura.ultimo_leido_id else 0,
            ).exclude(remitente=usuario).count()

            otro = conv.participante_b if conv.participante_a == usuario else conv.participante_a
            es_participante = usuario in (conv.participante_a, conv.participante_b)
            resultado.append({
                'id': conv.id_conversacion,
                'es_participante': es_participante,
                'otro_usuario': {
                    'id': otro.id_usuario,
                    'nombre': otro.nombre or otro.correo,
                    'rol': otro.rol.nombre_rol,
                },
                'plantel': conv.plantel.nombre,
                'sin_leer': sin_leer,
                'ultimo_mensaje': {
                    'texto': ultimo.texto() if ultimo else '',
                    'fecha': ultimo.fecha_envio.isoformat() if ultimo else None,
                } if ultimo else None,
            })

        return Response(resultado)

    def post(self, request):
        usuario = _usuario_sesion(request)
        if not usuario:
            return Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)

        id_otro = request.data.get('id_otro_usuario')
        try:
            otro = Usuario.objects.prefetch_related('planteles_asignados').get(pk=int(id_otro), activo=True)
        except (TypeError, ValueError, Usuario.DoesNotExist):
            return Response({'error': 'Usuario destino no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        rol_usuario = usuario.rol.nombre_rol
        rol_otro = otro.rol.nombre_rol

        # El superusuario puede hablar con todos; cualquiera puede hablar con el superusuario.
        if rol_usuario != 'superusuario' and rol_otro != 'superusuario':
            planteles_usuario = set(usuario.planteles_asignados.values_list('plantel_id', flat=True))
            planteles_otro = set(otro.planteles_asignados.values_list('plantel_id', flat=True))
            if not planteles_usuario.intersection(planteles_otro):
                return Response(
                    {'error': 'No puedes contactar usuarios de otro plantel.'},
                    status=status.HTTP_403_FORBIDDEN,
                )

        id_a, id_b = Conversacion.par_ordenado(usuario.id_usuario, otro.id_usuario)

        # Plantel para la conversación: en común si existe, si no el del docente, si no el primero disponible
        planteles_usuario = set(usuario.planteles_asignados.values_list('plantel_id', flat=True))
        planteles_otro = set(otro.planteles_asignados.values_list('plantel_id', flat=True))
        interseccion = planteles_usuario.intersection(planteles_otro)
        plantel_id = list(interseccion)[0] if interseccion else None
        if not plantel_id:
            plantel_id = (
                list(planteles_usuario)[0] if planteles_usuario
                else list(planteles_otro)[0] if planteles_otro
                else Plantel.objects.first().pk
            )

        conv, _ = Conversacion.objects.get_or_create(
            participante_a_id=id_a,
            participante_b_id=id_b,
            defaults={'plantel_id': plantel_id},
        )
        return Response({'id_conversacion': conv.id_conversacion}, status=status.HTTP_200_OK)


class MensajeListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, id_conv):
        usuario = _usuario_sesion(request)
        try:
            conv = Conversacion.objects.get(pk=id_conv)
        except Conversacion.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        rol = usuario.rol.nombre_rol if usuario else ''
        if not conv.es_participante(usuario.id_usuario if usuario else -1) and rol not in ('admin', 'superusuario'):
            return Response(status=status.HTTP_403_FORBIDDEN)

        mensajes = Mensaje.objects.filter(
            conversacion=conv, eliminado=False
        ).select_related('remitente')

        return Response([{
            'id': m.id_mensaje,
            'remitente_id': m.remitente_id,
            'texto': m.texto(),
            'metadatos': m.metadatos(),
            'fecha_envio': m.fecha_envio.isoformat(),
            'es_propio': m.remitente_id == (usuario.id_usuario if usuario else -1),
        } for m in mensajes])

    def post(self, request, id_conv):
        usuario = _usuario_sesion(request)
        if not usuario:
            return Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            conv = Conversacion.objects.get(pk=id_conv)
        except Conversacion.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if not conv.es_participante(usuario.id_usuario):
            return Response(status=status.HTTP_403_FORBIDDEN)

        texto = request.data.get('texto', '').strip()
        metadatos = request.data.get('metadatos', None)

        if not texto:
            return Response({'error': 'El mensaje no puede estar vacío.'}, status=status.HTTP_400_BAD_REQUEST)

        msg = Mensaje.crear(conv, usuario, texto, metadatos)
        return Response(
            {'id_mensaje': msg.id_mensaje, 'fecha_envio': msg.fecha_envio.isoformat()},
            status=status.HTTP_201_CREATED,
        )


class MarcarLeidoView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, id_conv):
        usuario = _usuario_sesion(request)
        if not usuario:
            return Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            conv = Conversacion.objects.get(pk=id_conv)
        except Conversacion.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        ultimo = Mensaje.objects.filter(conversacion=conv, eliminado=False).last()
        if ultimo:
            LecturaMensaje.objects.update_or_create(
                conversacion=conv,
                usuario=usuario,
                defaults={'ultimo_leido': ultimo},
            )
        return Response(status=status.HTTP_200_OK)


class UsuarioListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        rol = request.query_params.get('rol')
        id_plantel = request.query_params.get('plantel')

        q = request.query_params.get('q', '').strip()

        qs = Usuario.objects.select_related('rol').prefetch_related('planteles_asignados__plantel', 'planteles_asignados__turno').filter(activo=True)
        if rol:
            qs = qs.filter(rol__nombre_rol=rol)
        if id_plantel:
            turno_param = request.query_params.get('turno')
            if turno_param:
                up_subq = UsuarioPlantel.objects.filter(
                    usuario=OuterRef('pk'),
                    plantel_id=id_plantel,
                ).filter(
                    Q(turno__nombre_turno=turno_param) | Q(turno__nombre_turno='Mixto')
                )
                qs = qs.filter(Exists(up_subq))
            else:
                qs = qs.filter(planteles_asignados__plantel_id=id_plantel)
        excluir_roles = [r.strip() for r in request.query_params.get('excluir', '').split(',') if r.strip()]
        if excluir_roles:
            qs = qs.exclude(rol__nombre_rol__in=excluir_roles)
        if q:
            qs = qs.filter(Q(nombre__icontains=q) | Q(correo__icontains=q))[:20]

        return Response([{
            'id':      u.id_usuario,
            'nombre':  u.nombre or u.correo,
            'correo':  u.correo,
            'planteles': [{'plantel': up.plantel.nombre, 'turno': up.turno.nombre_turno} for up in u.planteles_asignados.all()],
            'rol':     u.rol.nombre_rol,
        } for u in qs])


class AdminsDisponiblesView(APIView):
    """Admins que puede contactar un docente: solo de sus planteles y en su turno."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        usuario = _usuario_sesion(request)
        if not usuario:
            return Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)

        asignaciones = UsuarioPlantel.objects.filter(
            usuario=usuario
        ).select_related('plantel', 'turno')

        admin_ids = set()
        for up in asignaciones:
            up_subq = UsuarioPlantel.objects.filter(
                usuario=OuterRef('pk'),
                plantel=up.plantel,
            ).filter(
                Q(turno__nombre_turno=up.turno.nombre_turno) | Q(turno__nombre_turno='Mixto')
            )
            ids = (
                Usuario.objects
                .filter(rol__nombre_rol='admin', activo=True)
                .filter(Exists(up_subq))
                .exclude(pk=usuario.pk)
                .values_list('pk', flat=True)
            )
            admin_ids.update(ids)

        admins = (
            Usuario.objects
            .filter(pk__in=admin_ids)
            .select_related('rol')
            .prefetch_related('planteles_asignados__plantel', 'planteles_asignados__turno')
        )
        vistos = set()
        resultado = []
        for u in list(admins):
            if u.pk in vistos:
                continue
            vistos.add(u.pk)
            resultado.append({
                'id':       u.id_usuario,
                'nombre':   u.nombre or u.correo,
                'correo':   u.correo,
                'planteles': [
                    {'plantel': up.plantel.nombre, 'turno': up.turno.nombre_turno}
                    for up in u.planteles_asignados.all()
                ],
            })

        return Response(resultado)


def _solicitud_dict(s):
    return {
        'id': s.id_solicitud_admin,
        'id_usuario': s.usuario_id,
        'nombre': s.usuario.nombre,
        'correo': s.usuario.correo,
        'plantel': s.plantel.nombre if s.plantel else '',
        'turno': s.turno.nombre_turno.lower() if s.turno else '',
        'motivo': s.motivo,
        'estado': s.estado,
        'fecha_solicitud': s.fecha_solicitud.isoformat(),
    }


class SolicitudAdminView(APIView):
    """Crea solicitudes (docente) y lista solicitudes (admin/superusuario)."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        estado = request.query_params.get('estado')
        qs = SolicitudAdmin.objects.select_related('usuario', 'plantel')
        if estado:
            qs = qs.filter(estado=estado)
        return Response([_solicitud_dict(s) for s in qs])

    def post(self, request):
        usuario = _usuario_sesion(request)
        if not usuario:
            return Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)

        # Si el usuario ya tiene una solicitud pendiente, se devuelve esa misma
        # (con ya_existe=True) en lugar de crear otra.
        existente = SolicitudAdmin.objects.filter(
            usuario=usuario, estado=SolicitudAdmin.ESTADO_PENDIENTE
        ).first()
        if existente:
            return Response(
                {'ya_existe': True, 'solicitud': _solicitud_dict(existente)},
                status=status.HTTP_200_OK,
            )

        plantel_nombre = (request.data.get('plantel') or '').strip()
        plantel_obj = Plantel.objects.filter(nombre__iexact=plantel_nombre).first() if plantel_nombre else None

        turno_nombre = (request.data.get('turno') or '').strip()
        turno_obj = Turno.objects.filter(nombre_turno__iexact=turno_nombre).first() if turno_nombre else None

        solicitud = SolicitudAdmin.objects.create(
            usuario=usuario,
            plantel=plantel_obj,
            turno=turno_obj,
            motivo=(request.data.get('motivo') or '').strip(),
        )
        return Response(
            {'ya_existe': False, 'solicitud': _solicitud_dict(solicitud)},
            status=status.HTTP_201_CREATED,
        )


class MiSolicitudAdminView(APIView):
    """Devuelve la solicitud pendiente del usuario actual (o null)."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        usuario = _usuario_sesion(request)
        if not usuario:
            return Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)
        solicitud = SolicitudAdmin.objects.filter(
            usuario=usuario, estado=SolicitudAdmin.ESTADO_PENDIENTE
        ).first()
        return Response({'solicitud': _solicitud_dict(solicitud) if solicitud else None})


class ResolverSolicitudAdminView(APIView):
    """Acepta o rechaza una solicitud. Al aceptar, el usuario pasa a rol admin."""
    permission_classes = [permissions.AllowAny]

    def post(self, request, id_solicitud):
        admin = _usuario_sesion(request)
        if not admin or admin.rol.nombre_rol not in ('admin', 'superusuario'):
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            solicitud = SolicitudAdmin.objects.select_related('usuario', 'plantel', 'turno').get(pk=id_solicitud)
        except SolicitudAdmin.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        accion = request.data.get('accion')
        if accion not in ('aceptar', 'rechazar'):
            return Response({'error': 'Acción inválida.'}, status=status.HTTP_400_BAD_REQUEST)

        if solicitud.estado != SolicitudAdmin.ESTADO_PENDIENTE:
            return Response({'error': 'La solicitud ya fue resuelta.'}, status=status.HTTP_409_CONFLICT)

        if accion == 'aceptar':
            try:
                rol_admin = Rol.objects.get(nombre_rol='admin')
            except Rol.DoesNotExist:
                return Response(
                    {'error': 'No existe el rol admin en el catálogo.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            usuario = solicitud.usuario
            usuario.rol = rol_admin
            usuario.save(update_fields=['rol'])
            # Crear entrada UsuarioPlantel con el plantel/turno de la solicitud
            if solicitud.plantel_id and solicitud.turno_id:
                UsuarioPlantel.objects.filter(usuario=usuario).delete()
                UsuarioPlantel.objects.create(usuario=usuario, plantel=solicitud.plantel, turno=solicitud.turno)
            solicitud.estado = SolicitudAdmin.ESTADO_ACEPTADA
        else:
            solicitud.estado = SolicitudAdmin.ESTADO_RECHAZADA

        solicitud.resuelta_por = admin
        solicitud.fecha_resolucion = timezone.now()
        solicitud.save(update_fields=['estado', 'resuelta_por', 'fecha_resolucion'])

        return Response({'solicitud': _solicitud_dict(solicitud)}, status=status.HTTP_200_OK)

    def delete(self, request, id_solicitud):
        """Elimina la solicitud de la BD. No afecta al Usuario ni a su rol."""
        admin = _usuario_sesion(request)
        if not admin or admin.rol.nombre_rol not in ('admin', 'superusuario'):
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            solicitud = SolicitudAdmin.objects.get(pk=id_solicitud)
        except SolicitudAdmin.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        solicitud.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CrearAdminView(APIView):
    """Superusuario da de alta un admin directamente con plantel y turno."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        superadmin = _usuario_sesion(request)
        if not superadmin or superadmin.rol.nombre_rol != 'superusuario':
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        correo = (request.data.get('correo') or '').strip()
        nombre = (request.data.get('nombre') or '').strip()
        plantel_id = request.data.get('plantel_id')
        turno_id = request.data.get('turno_id')

        if not correo:
            return Response({'error': 'correo es requerido.'}, status=status.HTTP_400_BAD_REQUEST)

        if plantel_id:
            try:
                plantel = Plantel.objects.get(pk=plantel_id)
                turno = Turno.objects.get(pk=int(turno_id)) if turno_id else None
                if turno is None:
                    turno, _ = Turno.objects.get_or_create(nombre_turno='Matutino')
            except (Plantel.DoesNotExist, Turno.DoesNotExist, TypeError, ValueError):
                return Response({'error': 'Plantel o turno no encontrado.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            datos = obtener_datos_por_correo(correo)
            if not datos or es_alumno(datos):
                return Response(
                    {'error': 'Correo no encontrado o corresponde a un alumno.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            if not nombre:
                nombre = (datos.get('nombre') or '').strip()
            adscripcion = (datos.get('adscripcion') or datos.get('nombreAdscripcion') or '').strip()
            plantel = Plantel.objects.filter(nombre__iexact=adscripcion).first() if adscripcion else None
            if not plantel:
                return Response(
                    {'error': f'Plantel "{adscripcion}" no encontrado en el sistema.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if turno_id:
                try:
                    turno = Turno.objects.get(pk=int(turno_id))
                except (Turno.DoesNotExist, TypeError, ValueError):
                    return Response({'error': 'Turno no encontrado.'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                turno, _ = Turno.objects.get_or_create(nombre_turno='Matutino')

        try:
            rol_admin = Rol.objects.get(nombre_rol='admin')
        except Rol.DoesNotExist:
            return Response({'error': 'Rol admin no existe en el catálogo.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        usuario, creado = Usuario.objects.get_or_create(
            correo=correo,
            defaults={'rol': rol_admin, 'nombre': nombre, 'activo': True},
        )
        if not creado:
            usuario.rol = rol_admin
            if nombre:
                usuario.nombre = nombre
            usuario.save(update_fields=['rol', 'nombre'])

        UsuarioPlantel.objects.filter(usuario=usuario).delete()
        UsuarioPlantel.objects.create(usuario=usuario, plantel=plantel, turno=turno)

        return Response({
            'id_usuario': usuario.id_usuario,
            'nombre': usuario.nombre or '',
            'correo': usuario.correo,
            'plantel': plantel.nombre,
            'turno': turno.nombre_turno.lower(),
        }, status=status.HTTP_201_CREATED if creado else status.HTTP_200_OK)


class ActualizarAdminView(APIView):
    """Superusuario edita nombre, asignación de plantel+turno y/o rol de un usuario."""
    permission_classes = [permissions.AllowAny]

    def patch(self, request, id_usuario):
        superadmin = _usuario_sesion(request)
        if not superadmin or superadmin.rol.nombre_rol != 'superusuario':
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            usuario = Usuario.objects.get(pk=id_usuario, activo=True)
        except Usuario.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        plantel_id = request.data.get('plantel_id')
        turno_id = request.data.get('turno_id')
        nombre = (request.data.get('nombre') or '').strip()
        nuevo_rol = request.data.get('rol')

        if nuevo_rol == 'docente':
            try:
                rol_obj = Rol.objects.get(nombre_rol='docente')
            except Rol.DoesNotExist:
                return Response({'error': 'Rol no válido.'}, status=status.HTTP_400_BAD_REQUEST)
            usuario.rol = rol_obj
            usuario.save(update_fields=['rol'])
            if nombre:
                Usuario.objects.filter(pk=usuario.pk).update(nombre=nombre)
            return Response({'ok': True, 'rol': nuevo_rol}, status=status.HTTP_200_OK)

        if plantel_id and turno_id:
            try:
                plantel = Plantel.objects.get(pk=plantel_id)
                turno = Turno.objects.get(pk=int(turno_id))
            except (Plantel.DoesNotExist, Turno.DoesNotExist, TypeError, ValueError):
                return Response({'error': 'Plantel o turno no encontrado.'}, status=status.HTTP_400_BAD_REQUEST)
            UsuarioPlantel.objects.filter(usuario=usuario).delete()
            UsuarioPlantel.objects.create(usuario=usuario, plantel=plantel, turno=turno)

        if nombre:
            Usuario.objects.filter(pk=usuario.pk).update(nombre=nombre)

        return Response({'ok': True}, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        usuario = _usuario_sesion(request)
        if usuario:
            Usuario.objects.filter(pk=usuario.pk).update(ultima_sesion=timezone.now())
        return Response(status=status.HTTP_200_OK)


class SesionActualView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        usuario = _usuario_sesion(request)
        if not usuario:
            return Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)
        return Response({
            'id_usuario': usuario.id_usuario,
            'rol': usuario.rol.nombre_rol,
            'nombre': usuario.nombre or '',
            'planteles': [
                {
                    'plantel': {'id': up.plantel.id_plantel, 'nombre': up.plantel.nombre},
                    'turno': {'id': up.turno.id_turno, 'nombre': up.turno.nombre_turno},
                }
                for up in usuario.planteles_asignados.all()
            ],
        })


class SolicitudBroadcastView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        usuario = _usuario_sesion(request)
        if not usuario:
            return Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)

        texto = request.data.get('texto', '').strip()
        metadatos = request.data.get('metadatos', None)
        if not texto:
            return Response({'error': 'El mensaje no puede estar vacío.'}, status=status.HTTP_400_BAD_REQUEST)

        id_plantel = request.data.get('id_plantel')
        hora_evento = request.data.get('hora_evento')
        turno_explicito = (request.data.get('turno') or '').strip()

        turno_buscado = turno_explicito or None
        if not turno_buscado and hora_evento:
            try:
                horas, minutos = map(int, hora_evento.split(':'))
                hora_minutos = horas * 60 + minutos
                turno_buscado = 'Matutino' if hora_minutos <= 13 * 60 + 20 else 'Vespertino'
            except ValueError:
                pass

        # Subquery garantiza que plantel_id y turno estén en el MISMO registro UsuarioPlantel.
        up_subq = UsuarioPlantel.objects.filter(
            usuario=OuterRef('pk'),
            plantel_id=id_plantel,
        )
        if turno_buscado:
            up_subq = up_subq.filter(
                Q(turno__nombre_turno=turno_buscado) | Q(turno__nombre_turno='Mixto')
            )

        destinatarios = list(
            Usuario.objects.filter(
                rol__nombre_rol='admin',
                activo=True,
            ).filter(Exists(up_subq))
        )
        if not destinatarios:
            return Response(
                {'error': 'No hay administradores disponibles.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        conversacion_ids = []
        for dest in destinatarios:
            id_a, id_b = Conversacion.par_ordenado(usuario.id_usuario, dest.id_usuario)
            conv, _ = Conversacion.objects.get_or_create(
                participante_a_id=id_a,
                participante_b_id=id_b,
                defaults={'plantel_id': id_plantel},
            )
            Mensaje.crear(conv, usuario, texto, metadatos)
            conversacion_ids.append(conv.id_conversacion)

        return Response({'conversaciones': conversacion_ids}, status=status.HTTP_201_CREATED)

class TurnoListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        turnos = Turno.objects.all().order_by('id_turno')
        return Response([
            {'id': t.id_turno, 'nombre': t.nombre_turno}
            for t in turnos
        ])

class PlantelListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        planteles = Plantel.objects.all().order_by('id_plantel')
        return Response([
            {'id': p.id_plantel, 'nombre': p.nombre}
            for p in planteles
        ])

class GuardarConfiguracionPlantelesView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        usuario = _usuario_sesion(request)
        if not usuario:
            return Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)
            
        selecciones = request.data.get('selecciones')
        if not isinstance(selecciones, dict) or not selecciones:
            return Response({'error': 'Configuración inválida.'}, status=status.HTTP_400_BAD_REQUEST)

        LIMITE_PLANTELES = 2
        if len(selecciones) > LIMITE_PLANTELES:
            return Response(
                {'error': f'No puedes tener más de {LIMITE_PLANTELES} planteles asignados.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
            
        # Limpiar asignaciones anteriores
        UsuarioPlantel.objects.filter(usuario=usuario).delete()
        
        TURNOS_VALIDOS = {'matutino', 'vespertino', 'mixto'}
        errores = []
        nuevos_registros = []
        for plantel_id, turnos in selecciones.items():
            try:
                plantel = Plantel.objects.get(pk=plantel_id)
            except Plantel.DoesNotExist:
                errores.append(f"Plantel no encontrado: {plantel_id}")
                continue

            # Exactamente un turno debe estar activo (Matutino, Vespertino o Mixto son excluyentes)
            activos = [tn for tn, activo in turnos.items() if activo and tn in TURNOS_VALIDOS]
            if len(activos) != 1:
                errores.append(f"Plantel {plantel_id}: debe seleccionarse exactamente un turno.")
                continue

            turno, _ = Turno.objects.get_or_create(nombre_turno=activos[0].capitalize())
            nuevos_registros.append(
                UsuarioPlantel(usuario=usuario, plantel=plantel, turno=turno)
            )
                        
        if nuevos_registros:
            UsuarioPlantel.objects.bulk_create(nuevos_registros)

        planteles_guardados = (
            UsuarioPlantel.objects
            .filter(usuario=usuario)
            .select_related('plantel', 'turno')
        )
        return Response({
            'mensaje': 'Configuración procesada',
            'registros_creados': len(nuevos_registros),
            'errores': errores,
            'planteles': [
                {
                    'plantel': {'id': up.plantel.id_plantel, 'nombre': up.plantel.nombre},
                    'turno':   {'id': up.turno.id_turno,    'nombre': up.turno.nombre_turno},
                }
                for up in planteles_guardados
            ],
        }, status=status.HTTP_200_OK)


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
            tipos = TipoEvento.objects.select_related('plantel').filter(plantel__isnull=True)
        else:
            rol = usuario.rol.nombre_rol
            if rol == 'superusuario':
                tipos = TipoEvento.objects.select_related('plantel').all()
            elif rol == 'admin':
                ids = list(usuario.planteles_asignados.values_list('plantel_id', flat=True))
                tipos = TipoEvento.objects.select_related('plantel').filter(
                    Q(plantel__isnull=True) | Q(plantel_id__in=ids)
                )
            else:
                ids = list(usuario.planteles_asignados.values_list('plantel_id', flat=True))
                tipos = TipoEvento.objects.select_related('plantel').filter(
                    Q(plantel__isnull=True) | Q(plantel_id__in=ids)
                )
        return Response([
            {'id': str(t.id_tipo_evento), 'etiqueta': t.nombre, 'color': t.color_hex,
             'es_global': t.plantel_id is None, 'plantel': t.plantel.nombre if t.plantel else None}
            for t in tipos
        ])

    def post(self, request):
        usuario = _usuario_sesion(request)
        if not usuario:
            return Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)
        rol = usuario.rol.nombre_rol
        if rol not in ('superusuario', 'admin'):
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        nombre = (request.data.get('nombre') or '').strip()
        color_hex = (request.data.get('color_hex') or '#64748B').strip()
        if not nombre:
            return Response({'error': 'El nombre es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)

        if rol == 'superusuario':
            plantel = None
        else:
            plantel_id = request.data.get('plantel_id')
            if not plantel_id:
                return Response({'error': 'Plantel inválido.'}, status=status.HTTP_400_BAD_REQUEST)
            ids = [str(pid) for pid in usuario.planteles_asignados.values_list('plantel_id', flat=True)]
            if str(plantel_id) not in ids:
                return Response({'error': 'No tienes acceso a ese plantel.'}, status=status.HTTP_403_FORBIDDEN)
            plantel = Plantel.objects.get(pk=plantel_id)

        tipo = TipoEvento.objects.create(nombre=nombre, color_hex=color_hex, plantel=plantel)
        return Response(
            {'id': str(tipo.id_tipo_evento), 'etiqueta': tipo.nombre, 'color': tipo.color_hex,
             'es_global': tipo.plantel_id is None},
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
        if rol == 'superusuario':
            return usuario, tipo, None
        if rol == 'admin':
            if tipo.plantel_id is None:
                return None, None, Response(
                    {'error': 'No puedes modificar tipos de evento globales.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            ids = list(usuario.planteles_asignados.values_list('plantel_id', flat=True))
            if tipo.plantel_id not in ids:
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
        'turno': ev.turno.nombre_turno if ev.turno else None,
        'id_calendario': ev.calendario_id,
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

def _normalizar_plantel(nombre):
    """Reduce un nombre de plantel a solo letras/números en minúsculas para
    comparar cadenas que vienen de distintas fuentes (API institucional vs BD),
    """
    return re.sub(r'[^a-z0-9]', '', (nombre or '').lower())

def _planteles_equivalentes(nombre):
    """IDs de planteles con nombre normalizado que coincide o contiene al buscado."""
    objetivo = _normalizar_plantel(nombre)
    if not objetivo:
        return []
    ids = []
    for p in Plantel.objects.all():
        n = _normalizar_plantel(p.nombre)
        if n and (n == objetivo or objetivo in n or n in objetivo):
            ids.append(p.id_plantel)
    return ids


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
            'tipo_evento', 'plantel', 'turno', 'creado_por__rol', 'semestre', 'grupo__letra'
        )
        usuario = _usuario_sesion(request)
        plantel_para_todos = Q(plantel__isnull=True)
        turno_para_todos = Q(turno__isnull=True)

        if usuario:
            rol = usuario.rol.nombre_rol
            if rol == 'superusuario':
                # Por defecto solo eventos generales (evita saturar el calendario)
                # Con plantel_filtro: generales + los de ese plantel en específico
                nombre_filtro = request.query_params.get('plantel_filtro')
                if nombre_filtro:
                    qs = qs.filter(plantel_para_todos | Q(plantel__nombre=nombre_filtro))
                else:
                    qs = qs.filter(plantel_para_todos)
            elif rol == 'admin':
                planteles = list(usuario.planteles_asignados.values_list('plantel_id', flat=True))
                qs = qs.filter(plantel_para_todos | Q(plantel_id__in=planteles))
            else:
                planteles = list(usuario.planteles_asignados.values_list('plantel_id', flat=True))
                turnos = list(usuario.planteles_asignados.values_list('turno_id', flat=True))
                cond_plantel = plantel_para_todos | Q(plantel_id__in=planteles)
                cond_turno = turno_para_todos | Q(turno_id__in=turnos)
                qs = qs.filter(cond_plantel & cond_turno)
        else:
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
                    ids = _planteles_equivalentes(plantel_nombre)
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
                qs = qs.filter(plantel_para_todos & turno_para_todos)

        return Response([_evento_dict(ev, usuario) for ev in qs])

    def post(self, request):
        usuario = _usuario_sesion(request)
        if not usuario:
            return Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)

        rol = usuario.rol.nombre_rol
        if rol not in ('admin', 'superusuario'):
            return Response({'error': 'No autorizado para crear eventos.'}, status=status.HTTP_403_FORBIDDEN)

        datos, error = self._leer_evento(request, usuario, rol)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)

        evento = Evento.objects.create(creado_por=usuario, **datos)
        evento = Evento.objects.select_related('tipo_evento', 'plantel', 'turno', 'creado_por__rol', 'semestre', 'grupo__letra').get(pk=evento.pk)
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

        semestre_val = d.get('semestre')
        grupo_val = (d.get('grupo') or '').strip().upper()
        semestre_obj = None
        if semestre_val is not None:
            try:
                semestre_obj = Semestre.objects.filter(id_semestre=int(semestre_val)).first()
            except (ValueError, TypeError):
                pass
        grupo_obj = None
        if semestre_obj and grupo_val:
            grupo_obj = Grupo.objects.filter(semestre=semestre_obj, letra_id=grupo_val).first()

        if rol == 'admin':
            if calendario.clave != Calendario.CLAVE_ESCOLARIZADO:
                return None, 'Solo puedes crear eventos en el calendario escolarizado.'
            asignaciones = list(usuario.planteles_asignados.select_related('plantel', 'turno').all())
            if not plantel:
                return None, 'Debes seleccionar tu plantel.'
            par_valido = next(
                (a for a in asignaciones if a.plantel_id == plantel.id_plantel), None
            )
            if not par_valido:
                return None, 'Solo puedes crear eventos en tu plantel asignado.'
            ids_plantel = [a.plantel_id for a in asignaciones]
            # Permitidos: tipos generales (sin plantel, institucionales) o los del
            # propio plantel. Solo se rechazan los de OTRO plantel.
            if tipo.plantel_id is not None and tipo.plantel_id not in ids_plantel:
                return None, 'El tipo de evento no pertenece a tu catálogo de plantel.'
            turno = par_valido.turno

        return {
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
            'turno': turno,
            'semestre': semestre_obj,
            'grupo': grupo_obj,
        }, None


class EventoDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def _obtener(self, request, id_evento):
        usuario = _usuario_sesion(request)
        try:
            evento = Evento.objects.select_related(
                'tipo_evento', 'plantel', 'turno', 'creado_por__rol', 'calendario',
                'semestre', 'grupo__letra'
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
        evento = Evento.objects.select_related('tipo_evento', 'plantel', 'turno', 'creado_por__rol', 'semestre', 'grupo__letra').get(pk=evento.pk)
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

AUDIENCIAS_ANUNCIO = {'todos', 'admin', 'docente', 'alumno'}

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
        plantel_para_todos = Q(plantel__isnull=True)
        turno_para_todos = Q(turno__isnull=True)

        if usuario:
            rol = usuario.rol.nombre_rol
            if rol == 'superusuario':
                # Lo mismo que calendario por defecto solo anuncios generales; con plantel_filtro añade los
                # de ese plantel
                nombre_filtro = request.query_params.get('plantel_filtro')
                if nombre_filtro:
                    qs = qs.filter(plantel_para_todos | Q(plantel__nombre=nombre_filtro))
                else:
                    qs = qs.filter(plantel_para_todos)
            elif rol == 'admin':
                planteles = list(usuario.planteles_asignados.values_list('plantel_id', flat=True))
                qs = qs.filter(plantel_para_todos | Q(plantel_id__in=planteles))
            else:
                planteles = list(usuario.planteles_asignados.values_list('plantel_id', flat=True))
                turnos = list(usuario.planteles_asignados.values_list('turno_id', flat=True))
                qs = qs.filter(
                    (plantel_para_todos | Q(plantel_id__in=planteles))
                    & Q(audiencia__in=[Anuncio.AUDIENCIA_TODOS, rol])
                    & (turno_para_todos | Q(turno_id__in=turnos))
                )
        else:
            rol = request.query_params.get('rol')
            plantel_nombre = request.query_params.get('plantel')
            turno_nombre = request.query_params.get('turno')
            if rol == 'alumno' and plantel_nombre:
                ids = _planteles_equivalentes(plantel_nombre)
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
        if rol not in ('admin', 'superusuario'):
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


class RegistrarDispositivoView(APIView):
    """Registra (o actualiza) el token FCM de un dispositivo y lo suscribe
    a sus temas: tema_todos, tema_rol_{rol} y, si se conoce, tema_plantel_{id}.

    Acepta el plantel por id (`plantel_id`) o por nombre (`plantel_nombre` /
    `plantel`). El nombre se resuelve con _planteles_equivalentes para cubrir
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
            ids = _planteles_equivalentes(plantel_nombre)
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
        general = Q(plantel__isnull=True)
        turno_para_todos = Q(turno__isnull=True)

        if usuario:
            rol = usuario.rol.nombre_rol
            if rol == 'superusuario':
                nombre_filtro = request.query_params.get('plantel_filtro')
                if nombre_filtro:
                    qs = qs.filter(general | Q(plantel__nombre=nombre_filtro))
                else:
                    qs = qs.filter(general)
            elif rol == 'admin':
                planteles = list(usuario.planteles_asignados.values_list('plantel_id', flat=True))
                qs = qs.filter(general | Q(plantel_id__in=planteles))
            else:
                planteles = list(usuario.planteles_asignados.values_list('plantel_id', flat=True))
                turnos = list(usuario.planteles_asignados.values_list('turno_id', flat=True))
                qs = qs.filter(
                    (general | Q(plantel_id__in=planteles))
                    & Q(audiencia__in=['todos', rol])
                    & (turno_para_todos | Q(turno_id__in=turnos))
                )
        else:
            rol = request.query_params.get('rol')
            plantel_nombre = request.query_params.get('plantel')
            turno_nombre = request.query_params.get('turno')
            if rol == 'alumno' and plantel_nombre:
                ids = _planteles_equivalentes(plantel_nombre)
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


def _email_desde_id_token(id_token):
    """Extrae el campo email del payload JWT sin verificación de firma.
    Solo se usa cuando el token viene directamente de oauth2.googleapis.com/token."""
    import base64
    import json as _json
    try:
        parts = id_token.split('.')
        if len(parts) < 2:
            return None
        padding = 4 - len(parts[1]) % 4
        payload = _json.loads(base64.urlsafe_b64decode(parts[1] + '=' * padding))
        return payload.get('email')
    except Exception:
        return None


class GoogleCalendarCallbackView(APIView):
    """Gestiona la vinculación de Google Calendar: estado (GET), vincular (POST), desvincular (DELETE).

    El personal opera con su Usuario local. El alumno no existe en la BD: al
    vincular se crea un Usuario mínimo (rol alumno, identificado por su UUID
    institucional en id_api) y su asignación plantel+turno en UsuarioPlantel,
    para que el motor de sincronización lo trate igual que a cualquier usuario.
    El semestre y grupo del alumno se guardan en la propia credencial para
    afinar qué eventos recibe.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        usuario = _usuario_google(request)
        if not usuario:
            return Response({'vinculado': False, 'email': None})
        try:
            cred = usuario.google_credentials
            return Response({'vinculado': True, 'email': cred.email_google})
        except GoogleOauthCredential.DoesNotExist:
            return Response({'vinculado': False, 'email': None})

    def post(self, request):
        usuario = _usuario_google(request)
        id_param = request.data.get('id_usuario')
        es_alumno_nuevo = usuario is None and id_param is not None and not str(id_param).strip().isdigit()
        if usuario is None and not es_alumno_nuevo:
            return Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)

        if usuario is not None and usuario.rol.nombre_rol == 'tutor':
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        code = request.data.get('code')
        if not code:
            return Response({'error': 'Código de autorización requerido.'}, status=status.HTTP_400_BAD_REQUEST)

        redirect_uri = request.data.get('redirect_uri') or settings.GOOGLE_OAUTH2_REDIRECT_URI
        payload = {
            'code': code,
            'client_id': settings.GOOGLE_OAUTH2_CLIENT_ID,
            'client_secret': settings.GOOGLE_OAUTH2_CLIENT_SECRET,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code',
        }
        try:
            resp = requests.post('https://oauth2.googleapis.com/token', data=payload, timeout=10)
        except requests.RequestException:
            return Response({'error': 'No se pudo contactar con Google.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        if resp.status_code != 200:
            return Response({'error': 'No se pudieron obtener los tokens de Google.'}, status=status.HTTP_400_BAD_REQUEST)

        tokens = resp.json()
        expiry = timezone.now() + timezone.timedelta(seconds=tokens.get('expires_in', 3600))

        email_google = _email_desde_id_token(tokens.get('id_token', ''))

        if usuario is None:
            usuario = self._crear_o_actualizar_alumno(request, str(id_param).strip(), email_google)

        existing = GoogleOauthCredential.objects.filter(usuario=usuario).first()
        refresh_token = tokens.get('refresh_token') or (existing.refresh_token if existing else None)

        defaults = {
            'email_google': email_google,
            'access_token': tokens['access_token'],
            'refresh_token': refresh_token,
            'scopes': tokens.get('scope', ''),
            'expiry': expiry,
        }
        if usuario.rol.nombre_rol == 'alumno':
            semestre_obj, grupo_obj = _resolver_semestre_grupo(
                request.data.get('semestre'), request.data.get('grupo')
            )
            defaults['semestre'] = semestre_obj
            defaults['grupo'] = grupo_obj

        _, created = GoogleOauthCredential.objects.update_or_create(
            usuario=usuario, defaults=defaults,
        )
        if created:
            threading.Thread(target=backfill_usuario, args=(usuario,), daemon=True).start()
        return Response({'status': 'Conexión con Google Calendar exitosa.', 'email': email_google})

    def delete(self, request):
        usuario = _usuario_google(request)
        if not usuario:
            return Response(status=status.HTTP_204_NO_CONTENT)
        GoogleOauthCredential.objects.filter(usuario=usuario).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _crear_o_actualizar_alumno(self, request, uuid, email_google):
        """Crea (o recupera) el Usuario mínimo del alumno y su asignación plantel+turno."""
        rol_alumno, _ = Rol.objects.get_or_create(nombre_rol='alumno')
        usuario = Usuario.objects.select_related('rol').filter(id_api=uuid).first()
        if usuario is None:
            correo = email_google or f'{uuid}@alumno.cobach'
            if Usuario.objects.filter(correo=correo).exists():
                correo = f'{uuid}@alumno.cobach'
            usuario = Usuario.objects.create(
                rol=rol_alumno, correo=correo, id_api=uuid, activo=True,
            )

        plantel_id = request.data.get('plantel_id')
        plantel = Plantel.objects.filter(pk=plantel_id).first() if plantel_id else None
        turno_nombre = (request.data.get('turno_nombre') or '').strip()
        turno = Turno.objects.get_or_create(nombre_turno=turno_nombre)[0] if turno_nombre else None
        if plantel and turno:
            UsuarioPlantel.objects.get_or_create(usuario=usuario, plantel=plantel, turno=turno)

        return usuario


class GoogleAuthView(APIView):
    """Verifica el ID token de Google y redirige al dashboard si el dominio es válido."""

    INSTITUTIONAL_ROLES = frozenset({'admin', 'docente', 'alumno', 'personal'})
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        role = request.data.get('role') or request.POST.get('role')
        if role and role not in self.INSTITUTIONAL_ROLES:
            return Response(status=status.HTTP_403_FORBIDDEN)

        # Flujo de código (login combinado con Calendar): recibe code + redirect_uri
        code = request.data.get('code')
        calendar_tokens = None
        if code:
            redirect_uri = request.data.get('redirect_uri', '')
            payload = {
                'code': code,
                'client_id': settings.GOOGLE_OAUTH2_CLIENT_ID,
                'client_secret': settings.GOOGLE_OAUTH2_CLIENT_SECRET,
                'redirect_uri': redirect_uri,
                'grant_type': 'authorization_code',
            }
            try:
                token_resp = requests.post('https://oauth2.googleapis.com/token', data=payload, timeout=10)
            except requests.RequestException:
                return Response(status=status.HTTP_503_SERVICE_UNAVAILABLE)
            if token_resp.status_code != 200:
                return Response({'google_error': token_resp.json()}, status=status.HTTP_400_BAD_REQUEST)
            calendar_tokens = token_resp.json()
            id_token = calendar_tokens.get('id_token')
        else:
            # Flujo implícito legacy: recibe id_token directamente
            id_token = request.data.get('token') or request.POST.get('token')

        if not id_token:
            return Response(status=status.HTTP_204_NO_CONTENT)

        tokeninfo_url = 'https://oauth2.googleapis.com/tokeninfo'
        try:
            resp = requests.get(tokeninfo_url, params={'id_token': id_token}, timeout=5)
        except requests.RequestException:
            return Response(status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if resp.status_code != 200:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        datos = resp.json()

        expected_aud = getattr(settings, 'GOOGLE_OAUTH2_CLIENT_ID', '')
        if expected_aud and datos.get('aud') != expected_aud:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        correo = datos.get('email')
        correo_verificado = datos.get('email_verified') in (True, 'true', 'True', '1')
        if not correo or not correo_verificado:
            return Response(status=status.HTTP_204_NO_CONTENT)

        if not correo.endswith('@cobach.edu.mx'):
            return Response(status=status.HTTP_204_NO_CONTENT)

        # Verificar estatus activo en la API institucional
        datos_institucional = obtener_datos_por_correo(correo)
        if (datos_institucional.get('estatus') or '').strip().upper() != 'ACTIVO':
            return Response(
                {'error': 'Cuenta inactiva en el sistema institucional.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Para alumnos: verificar que el correo corresponda a un alumno
        if role == 'alumno' and not es_alumno(datos_institucional):
            return Response(status=status.HTTP_403_FORBIDDEN)

        tipo_empleado = (datos_institucional.get('tipoEmpleado') or '').strip()
        nombre_api = (datos_institucional.get('nombre') or '').strip()
        adscripcion = str(datos_institucional.get('adscripcion') or datos_institucional.get('nombreAdscripcion') or '')
        id_api_val = str(datos_institucional.get('id') or '')

        if role == 'alumno':
            return Response({
                'token': f'google-alumno-{correo}',
                'nombre': nombre_api,
                'sesion': {
                    'id_usuario': None,
                    'rol': 'alumno',
                    'correo': correo,
                    'planteles': [],
                    'tipoEmpleado': tipo_empleado,
                    'adscripcion': adscripcion,
                },
            }, status=status.HTTP_200_OK)

        # Empleado (docente / administrativo): buscar o crear en BD local
        try:
            rol_obj, _ = Rol.objects.get_or_create(nombre_rol='docente')
            usuario, _ = Usuario.objects.get_or_create(
                correo=correo,
                defaults={'rol': rol_obj, 'nombre': nombre_api, 'activo': True},
            )
            if nombre_api and usuario.nombre != nombre_api:
                Usuario.objects.filter(pk=usuario.pk).update(nombre=nombre_api)
            if id_api_val and usuario.id_api != id_api_val:
                Usuario.objects.filter(pk=usuario.pk).update(id_api=id_api_val)
            usuario = (
                Usuario.objects
                .select_related('rol')
                .prefetch_related(
                    'planteles_asignados__plantel',
                    'planteles_asignados__turno',
                )
                .get(pk=usuario.pk, activo=True)
            )
        except Usuario.DoesNotExist:
            return Response({'error': 'Usuario no activo.'}, status=status.HTTP_403_FORBIDDEN)

        # Para role=admin verificar que el rol local sea admin o superusuario
        rol_real = usuario.rol.nombre_rol
        if role == 'admin' and rol_real not in ('admin', 'superusuario'):
            return Response(
                {'error': 'No tienes perfil de administrador.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Guardar credenciales de Google Calendar solo si el código incluía scope de calendar
        google_calendar_vinculado = False
        returned_scope = (calendar_tokens or {}).get('scope', '')
        if calendar_tokens and calendar_tokens.get('access_token') and 'calendar' in returned_scope:
            expiry = timezone.now() + timezone.timedelta(seconds=calendar_tokens.get('expires_in', 3600))
            existing = GoogleOauthCredential.objects.filter(usuario=usuario).first()
            refresh_token_final = calendar_tokens.get('refresh_token') or (existing.refresh_token if existing else None)
            _, created = GoogleOauthCredential.objects.update_or_create(
                usuario=usuario,
                defaults={
                    'access_token': calendar_tokens['access_token'],
                    'refresh_token': refresh_token_final,
                    'scopes': returned_scope,
                    'expiry': expiry,
                },
            )
            google_calendar_vinculado = True
            if created:
                threading.Thread(target=backfill_usuario, args=(usuario,), daemon=True).start()

        return Response({
            'token': f'google-{correo}',
            'nombre': usuario.nombre or nombre_api,
            'sesion': {
                'id_usuario': usuario.id_usuario,
                'rol': usuario.rol.nombre_rol,
                'correo': usuario.correo or '',
                'planteles': [
                    {
                        'plantel': {'id': up.plantel.id_plantel, 'nombre': up.plantel.nombre},
                        'turno': {'id': up.turno.id_turno, 'nombre': up.turno.nombre_turno},
                    }
                    for up in usuario.planteles_asignados.all()
                ],
                'tipoEmpleado': tipo_empleado,
                'adscripcion': adscripcion,
                'google_calendar_vinculado': google_calendar_vinculado,
            },
        }, status=status.HTTP_200_OK)


class EstadisticasDashboardView(APIView):
    """Indicadores del dashboard admin/superusuario.

    Alcance por rol: el superusuario ve toda la institución; el admin solo los
    usuarios asignados a sus planteles (vía UsuarioPlantel). 'activos_semana'
    cuenta quienes tienen sesión en los últimos 7 días."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        usuario = _usuario_sesion(request)
        if not usuario:
            return Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)

        qs = Usuario.objects.filter(activo=True)
        ambito = 'institucion'

        if usuario.rol.nombre_rol == 'admin':
            planteles = list(usuario.planteles_asignados.values_list('plantel_id', flat=True))
            qs = qs.filter(planteles_asignados__plantel_id__in=planteles).distinct()
            ambito = 'plantel'

        hace_semana = timezone.now() - timedelta(days=7)
        return Response({
            'ambito': ambito,
            'usuarios_activos': qs.count(),
            'activos_semana': qs.filter(ultima_sesion__gte=hace_semana).count(),
        })
