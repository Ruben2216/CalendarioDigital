from django.shortcuts import redirect
from django.conf import settings

import requests

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from .serializers import LoginInstitucionalSerializer
from .services.mock_institucional import (
    mock_login_empleado,
    mock_login_alumno,
)
from .models import Usuario


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
