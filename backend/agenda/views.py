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
    mock_login_alumno,
)
from .models import Usuario, Rol, Conversacion, Mensaje, LecturaMensaje, SolicitudAdmin


ROLES_EMPLEADO = {'superusuario', 'admin', 'docente'}


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

        if rol_solicitado == 'alumno':
            respuesta_institucional = mock_login_alumno(user_name, password)
            credenciales_validas = respuesta_institucional.get('estatusLogin') == 1
            id_externo = respuesta_institucional.get('matricula')
            campo_busqueda = 'matricula'
        else:
            respuesta_institucional = mock_login_empleado(user_name, password)
            credenciales_validas = respuesta_institucional.get('exito') is True
            id_externo = respuesta_institucional.get('idEmpleado')
            campo_busqueda = 'id_empleado'

        if not credenciales_validas:
            return Response(
                {'error': 'Credenciales incorrectas.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        try:
            filtro = {campo_busqueda: id_externo, 'activo': True}
            usuario = (
                Usuario.objects
                .select_related('rol', 'plantel', 'turno')
                .prefetch_related('permisos_especiales__turno_objetivo')
                .get(**filtro)
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
                'id_turno': pe.turno_objetivo.id,
                'nombre_turno': pe.turno_objetivo.nombre_turno,
            }
            for pe in usuario.permisos_especiales.filter(activo=True)
        ]

        return Response({
            'token': respuesta_institucional.get('token', ''),
            'nombre': respuesta_institucional.get('nombre', ''),
            'foto': respuesta_institucional.get('foto', ''),
            'qr': respuesta_institucional.get('qr', ''),
            'sesion': {
                'id_usuario': usuario.id,
                'rol': usuario.rol.nombre_rol,
                'plantel': {
                    'id': usuario.plantel.id if usuario.plantel else None,
                    'nombre': usuario.plantel.nombre if usuario.plantel else None,
                    'clave': usuario.plantel.clave if usuario.plantel else None,
                },
                'turno': {
                    'id': usuario.turno.id if usuario.turno else None,
                    'nombre': usuario.turno.nombre_turno if usuario.turno else None,
                },
                'permisos_especiales': permisos_extra,
            },
        }, status=status.HTTP_200_OK)


def _usuario_sesion(request):
    """Lee id_usuario del body o query params y devuelve el Usuario activo."""
    id_usuario = request.data.get('id_usuario') or request.query_params.get('id_usuario')
    try:
        return (
            Usuario.objects
            .select_related('rol', 'plantel')
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
            docentes = Usuario.objects.filter(
                rol__nombre_rol='docente', plantel=usuario.plantel, activo=True
            )

        docentes = docentes.select_related('rol', 'plantel', 'turno')
        return Response([{
            'id': d.id,
            'nombre': d.nombre or d.correo,
            'correo': d.correo,
            'turno': d.turno.nombre_turno if d.turno else None,
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
            convs = Conversacion.objects.filter(activa=True, plantel=usuario.plantel)
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
                id__gt=lectura.ultimo_leido_id if lectura and lectura.ultimo_leido_id else 0,
            ).exclude(remitente=usuario).count()

            otro = conv.participante_b if conv.participante_a == usuario else conv.participante_a
            resultado.append({
                'id': conv.id,
                'otro_usuario': {
                    'id': otro.id,
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
            otro = Usuario.objects.select_related('plantel').get(pk=int(id_otro), activo=True)
        except (TypeError, ValueError, Usuario.DoesNotExist):
            return Response({'error': 'Usuario destino no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        if usuario.rol.nombre_rol != 'superusuario':
            if usuario.plantel != otro.plantel:
                return Response(
                    {'error': 'No puedes contactar usuarios de otro plantel.'},
                    status=status.HTTP_403_FORBIDDEN,
                )

        id_a, id_b = Conversacion.par_ordenado(usuario.id, otro.id)
        plantel = usuario.plantel or otro.plantel
        conv, _ = Conversacion.objects.get_or_create(
            participante_a_id=id_a,
            participante_b_id=id_b,
            defaults={'plantel': plantel},
        )
        return Response({'id_conversacion': conv.id}, status=status.HTTP_200_OK)


class MensajeListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, id_conv):
        usuario = _usuario_sesion(request)
        try:
            conv = Conversacion.objects.get(pk=id_conv)
        except Conversacion.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        rol = usuario.rol.nombre_rol if usuario else ''
        if not conv.es_participante(usuario.id if usuario else -1) and rol not in ('admin', 'superusuario'):
            return Response(status=status.HTTP_403_FORBIDDEN)

        mensajes = Mensaje.objects.filter(
            conversacion=conv, eliminado=False
        ).select_related('remitente')

        return Response([{
            'id': m.id,
            'remitente_id': m.remitente_id,
            'texto': m.texto(),
            'metadatos': m.metadatos(),
            'fecha_envio': m.fecha_envio.isoformat(),
            'es_propio': m.remitente_id == (usuario.id if usuario else -1),
        } for m in mensajes])

    def post(self, request, id_conv):
        usuario = _usuario_sesion(request)
        if not usuario:
            return Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            conv = Conversacion.objects.get(pk=id_conv)
        except Conversacion.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if not conv.es_participante(usuario.id):
            return Response(status=status.HTTP_403_FORBIDDEN)

        texto = request.data.get('texto', '').strip()
        metadatos = request.data.get('metadatos', None)

        if not texto:
            return Response({'error': 'El mensaje no puede estar vacío.'}, status=status.HTTP_400_BAD_REQUEST)

        msg = Mensaje.crear(conv, usuario, texto, metadatos)
        return Response(
            {'id_mensaje': msg.id, 'fecha_envio': msg.fecha_envio.isoformat()},
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

        qs = Usuario.objects.select_related('rol', 'plantel', 'turno').filter(activo=True)
        if rol:
            qs = qs.filter(rol__nombre_rol=rol)
        if id_plantel:
            try:
                qs = qs.filter(plantel__id=int(id_plantel))
            except (TypeError, ValueError):
                pass

        return Response([{
            'id':      u.id,
            'nombre':  u.nombre or u.correo,
            'correo':  u.correo,
            'plantel': u.plantel.nombre if u.plantel else None,
            'turno':   u.turno.nombre_turno if u.turno else None,
            'rol':     u.rol.nombre_rol,
        } for u in qs])


def _solicitud_dict(s):
    return {
        'id': s.id,
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
            # ───────── PUNTO DEL CAMBIO DE ROL: docente → admin ─────────
            # Aquí es donde el usuario deja de ser docente y se vuelve admin.
            usuario = solicitud.usuario
            usuario.rol = rol_admin
            usuario.save(update_fields=['rol'])
            # ────────────────────────────────────────────────────────────
            solicitud.estado = SolicitudAdmin.ESTADO_ACEPTADA
        else:
            solicitud.estado = SolicitudAdmin.ESTADO_RECHAZADA

        solicitud.resuelta_por = admin
        solicitud.fecha_resolucion = timezone.now()
        solicitud.save(update_fields=['estado', 'resuelta_por', 'fecha_resolucion'])

        return Response({'solicitud': _solicitud_dict(solicitud)}, status=status.HTTP_200_OK)


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
