from django.conf import settings
from django.utils import timezone

import requests

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from ._comunes import _email_desde_id_token, _qr_data_uri, _resolver_semestre_grupo, _TURNOS_ALUMNO, _usuario_google, _usuario_sesion
from ..models import DispositivoFCM, GoogleOauthCredential, Plantel, Rol, Turno, Usuario, UsuarioPlantel
from ..serializers import LoginInstitucionalSerializer
from ..services import notificaciones_push as push
from ..services.google_calendar import backfill_usuario
from ..services.mock_institucional import es_alumno, login_alumno, mock_login_empleado, obtener_datos_por_correo

import logging
import threading

logger = logging.getLogger(__name__)


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

        if usuario_local and usuario_local.verificar_password_mock(password):
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
                rol_solicitado == 'admin' and rol_real in ('superusuario', 'colaborador')
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

        # Sincronizar plantel desde adscripción institucional: usuarios nuevos y
        # usuarios reiniciados (sin asignación) recuperan su adscripción original
        resincronizar = usuario.rol.nombre_rol in ('colaborador', 'docente', 'personal') and not usuario.ids_planteles()
        if datos_empleado and usuario.rol.nombre_rol != 'admin' and (not usuario_local or resincronizar):
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
            'sesion': usuario.a_sesion_dict(
                tipoEmpleado=datos_empleado.get('tipoEmpleado', ''),
                adscripcion=datos_empleado.get('adscripcion', '') or datos_empleado.get('nombreAdscripcion', ''),
            ),
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
                {'error': 'Solo se permite el acceso a usuarios activos'},
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

        # Para role=admin verificar que el rol local sea admin, superusuario o colaborador
        rol_real = usuario.rol.nombre_rol
        if role == 'admin' and rol_real not in ('admin', 'superusuario', 'colaborador'):
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
            'sesion': usuario.a_sesion_dict(
                tipoEmpleado=tipo_empleado,
                adscripcion=adscripcion,
                google_calendar_vinculado=google_calendar_vinculado,
            ),
        }, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        usuario = _usuario_sesion(request)
        if usuario:
            Usuario.objects.filter(pk=usuario.pk).update(ultima_sesion=timezone.now())

        # Desuscribe el token de sus temas para que el siguiente usuario del mismo dispositivo 
        token = (request.data.get('token_fcm') or '').strip()
        if token:
            dispositivo = DispositivoFCM.objects.filter(token_fcm=token).first()
            if dispositivo:
                temas = list(dispositivo.temas or [])
                if temas:
                    try:
                        push.desuscribir(token, temas)
                    except Exception:
                        logger.exception('Fallo al desuscribir el token en el logout')
                DispositivoFCM.objects.filter(pk=dispositivo.pk).update(activo=False, temas=[])

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
