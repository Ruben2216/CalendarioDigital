from django.shortcuts import redirect
from django.conf import settings
from django.utils import timezone

import requests

from django.db.models import Q

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
from .models import Usuario, Rol, Conversacion, Mensaje, LecturaMensaje, SolicitudAdmin, UsuarioPlantel, Plantel, Turno

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
        if rol_solicitado in ('admin', 'superusuario'):
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
                .prefetch_related('permisos_especiales__turno_objetivo', 'planteles_asignados__plantel', 'planteles_asignados__turno')
                .get(pk=usuario.pk, activo=True)
            )
        except Usuario.DoesNotExist:
            return Response(
                {'error': 'Usuario no registrado en el sistema.'},
                status=status.HTTP_404_NOT_FOUND
            )

        rol_real = usuario.rol.nombre_rol
        # superusuario puede entrar por el botón Administrador (mismo endpoint de personal)
        rol_compatible = rol_real == rol_solicitado or (
            rol_solicitado == 'admin' and rol_real == 'superusuario'
        )
        if not rol_compatible:
            return Response(
                {'error': 'El perfil seleccionado no corresponde a tu cuenta.'},
                status=status.HTTP_403_FORBIDDEN
            )

        permisos_extra = [
            {
                'id_turno': pe.turno_objetivo.id_turno,
                'nombre_turno': pe.turno_objetivo.nombre_turno,
            }
            for pe in usuario.permisos_especiales.filter(activo=True)
        ]

        datos_empleado = {}
        if rol_solicitado != 'alumno' and id_externo:
            datos_empleado = obtener_datos_por_correo(id_externo)
            id_api_value = str(datos_empleado['id']) if datos_empleado.get('id') is not None else None
            if id_api_value and usuario.id_api != id_api_value:
                Usuario.objects.filter(pk=usuario.pk).update(id_api=id_api_value)

        return Response({
            'token': respuesta_institucional.get('token', ''),
            'nombre': usuario.nombre or '',
            'foto': respuesta_institucional.get('foto', ''),
            'qr': respuesta_institucional.get('qr', ''),
            'sesion': {
                'id_usuario': usuario.id_usuario,
                'rol': usuario.rol.nombre_rol,
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
                'permisos_especiales': permisos_extra,
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
                    'id': None,
                    'nombre': datos.get('plantel'),
                },
                'turno': {
                    'id': None,
                    'nombre': _TURNOS_ALUMNO.get(codigo_turno, datos.get('turno')),
                },
                'grupo': datos.get('grupo'),
                'semestre': datos.get('semestre'),
                'permisos_especiales': [],
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
            convs = Conversacion.objects.filter(activa=True)
        elif rol == 'admin':
            planteles_ids = usuario.planteles_asignados.values_list('plantel_id', flat=True)
            convs = Conversacion.objects.filter(activa=True, plantel_id__in=planteles_ids)
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
            resultado.append({
                'id': conv.id_conversacion,
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

        if usuario.rol.nombre_rol != 'superusuario':
            planteles_usuario = set(usuario.planteles_asignados.values_list('plantel_id', flat=True))
            planteles_otro = set(otro.planteles_asignados.values_list('plantel_id', flat=True))
            if not planteles_usuario.intersection(planteles_otro):
                return Response(
                    {'error': 'No puedes contactar usuarios de otro plantel.'},
                    status=status.HTTP_403_FORBIDDEN,
                )

        id_a, id_b = Conversacion.par_ordenado(usuario.id_usuario, otro.id_usuario)
        
        # Encontrar plantel en común para la conversación
        planteles_usuario = set(usuario.planteles_asignados.values_list('plantel_id', flat=True))
        planteles_otro = set(otro.planteles_asignados.values_list('plantel_id', flat=True))
        interseccion = planteles_usuario.intersection(planteles_otro)
        plantel_id = list(interseccion)[0] if interseccion else None
        if not plantel_id:
            plantel_id = list(planteles_usuario)[0] if planteles_usuario else list(planteles_otro)[0] if planteles_otro else Plantel.objects.first().pk

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

        qs = Usuario.objects.select_related('rol').prefetch_related('planteles_asignados__plantel', 'planteles_asignados__turno').filter(activo=True)
        if rol:
            qs = qs.filter(rol__nombre_rol=rol)
        if id_plantel:
            try:
                qs = qs.filter(planteles_asignados__plantel_id=int(id_plantel))
            except (TypeError, ValueError):
                pass

        return Response([{
            'id':      u.id_usuario,
            'nombre':  u.nombre or u.correo,
            'correo':  u.correo,
            'planteles': [{'plantel': up.plantel.nombre, 'turno': up.turno.nombre_turno} for up in u.planteles_asignados.all()],
            'rol':     u.rol.nombre_rol,
        } for u in qs])


def _solicitud_dict(s):
    return {
        'id': s.id_solicitud_admin,
        'id_usuario': s.usuario_id,
        'nombre': s.nombre,
        'correo': s.correo,
        'plantel': s.plantel,
        'turno': s.turno,
        'motivo': s.motivo,
        'estado': s.estado,
        'fecha_solicitud': s.fecha_solicitud.isoformat(),
    }


class SolicitudAdminView(APIView):
    """Crea solicitudes (docente) y lista solicitudes (admin/superusuario)."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        estado = request.query_params.get('estado')
        qs = SolicitudAdmin.objects.select_related('usuario')
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

        solicitud = SolicitudAdmin.objects.create(
            usuario=usuario,
            nombre=(request.data.get('nombre') or usuario.nombre or '').strip(),
            correo=(request.data.get('correo') or usuario.correo or '').strip(),
            plantel=(request.data.get('plantel') or '').strip(),
            turno=(request.data.get('turno') or '').strip(),
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
            solicitud = SolicitudAdmin.objects.select_related('usuario').get(pk=id_solicitud)
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
            solicitud.estado = SolicitudAdmin.ESTADO_ACEPTADA
        else:
            solicitud.estado = SolicitudAdmin.ESTADO_RECHAZADA

        solicitud.resuelta_por = admin
        solicitud.fecha_resolucion = timezone.now()
        solicitud.save(update_fields=['estado', 'resuelta_por', 'fecha_resolucion'])

        return Response({'solicitud': _solicitud_dict(solicitud)}, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        usuario = _usuario_sesion(request)
        if usuario:
            Usuario.objects.filter(pk=usuario.pk).update(ultima_sesion=timezone.now())
        return Response(status=status.HTTP_200_OK)


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
        hora_evento = request.data.get('hora_evento') # formato "HH:MM" ej "10:30" o "15:00"
        
        # Filtros base para los administradores del plantel dado
        admins_qs = Usuario.objects.filter(
            rol__nombre_rol='admin', 
            activo=True,
            planteles_asignados__plantel_id=id_plantel
        )
        
        turno_buscado = None
        if hora_evento:
            try:
                # La lógica de Mixto: corte 13:20
                horas, minutos = map(int, hora_evento.split(':'))
                hora_minutos = horas * 60 + minutos
                if hora_minutos <= 13 * 60 + 20:
                    turno_buscado = 'Matutino'
                else:
                    turno_buscado = 'Vespertino'
            except ValueError:
                pass

        # Buscamos admins que coincidan con el turno_buscado o que tengan turno Mixto
        if turno_buscado:
            admins_qs = admins_qs.filter(
                Q(planteles_asignados__turno__nombre_turno=turno_buscado) |
                Q(planteles_asignados__turno__nombre_turno='Mixto')
            )
        
        admins = list(admins_qs.distinct())
        
        superadmins = (
            Usuario.objects
            .filter(rol__nombre_rol='superusuario', activo=True)
        )

        destinatarios = admins + list(superadmins)
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

class GuardarConfiguracionPlantelesView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        usuario = _usuario_sesion(request)
        if not usuario:
            return Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)
            
        selecciones = request.data.get('selecciones')
        if not isinstance(selecciones, dict) or not selecciones:
            return Response({'error': 'Configuración inválida.'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Limpiar asignaciones anteriores
        UsuarioPlantel.objects.filter(usuario=usuario).delete()
        
        errores = []
        nuevos_registros = []
        for plantel_id, turnos in selecciones.items():
            try:
                plantel = Plantel.objects.get(pk=int(plantel_id))
            except (ValueError, Plantel.DoesNotExist):
                errores.append(f"Plantel no encontrado: {plantel_id}")
                continue
                
            for turno_nombre, activo in turnos.items():
                if activo:
                    try:
                        # Convertimos "matutino", "vespertino" a capitalizado
                        turno = Turno.objects.get(nombre_turno__iexact=turno_nombre)
                        nuevos_registros.append(
                            UsuarioPlantel(usuario=usuario, plantel=plantel, turno=turno)
                        )
                    except Turno.DoesNotExist:
                        errores.append(f"Turno no encontrado: {turno_nombre}")
                        continue
                        
        if nuevos_registros:
            UsuarioPlantel.objects.bulk_create(nuevos_registros)
            
        return Response({
            'mensaje': 'Configuración procesada',
            'registros_creados': len(nuevos_registros),
            'errores': errores,
            'selecciones_recibidas': selecciones
        }, status=status.HTTP_200_OK)


class GoogleAuthView(APIView):
    """Verifica el ID token de Google y redirige al dashboard si el dominio es válido."""

    INSTITUTIONAL_ROLES = frozenset({'admin', 'docente', 'alumno'})
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        role = request.data.get('role') or request.POST.get('role')
        if role and role not in self.INSTITUTIONAL_ROLES:
            return Response(status=status.HTTP_403_FORBIDDEN)

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

        # Si el acceso es como alumno, verificamos contra la API institucional
        # que el correo realmente pertenezca a un alumno.
        if role == 'alumno' and not es_alumno(obtener_datos_por_correo(correo)):
            return Response(status=status.HTTP_403_FORBIDDEN)

        origin = request.headers.get('origin') or request.META.get('HTTP_ORIGIN')
        allowed = getattr(settings, 'CORS_ALLOWED_ORIGINS', [])
        fallback = getattr(settings, 'FRONTEND_DASHBOARD_URL', 'http://localhost:5173/dashboard')

        def origin_allowed(o):
            if not o:
                return False
            if "ngrok-free.app" in o:
                return True
            if o in allowed:
                return True
            for a in allowed:
                if a.startswith('.') and o.endswith(a):
                    return True
                if a.startswith('http') and o == a:
                    return True
                try:
                    host = o.split('://', 1)[1]
                except Exception:
                    host = o
                if a == host or (a.startswith('.') and host.endswith(a.lstrip('.'))):
                    return True
            return False

        if origin and origin_allowed(origin):
            redirect_url = origin.rstrip('/') + '/dashboard'
        else:
            redirect_url = fallback.replace('.html', '')

        dummy_token = f"dummy-token-{correo}"
        is_xhr = (
            request.headers.get('x-requested-with') == 'XMLHttpRequest'
            or 'application/json' in request.headers.get('accept', '')
        )
        if is_xhr:
            return Response(
                {'redirect': redirect_url, 'token': dummy_token},
                status=status.HTTP_200_OK
            )
        return redirect(redirect_url)
