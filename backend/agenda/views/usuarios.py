from django.db.models import Exists, Q
from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from ._comunes import _usuario_sesion
from ..models import Notificacion, Agrupacion, Plantel, Rol, Turno, Usuario, UsuarioPlantel
from ..services import notificaciones_personales as notif
from ..services.mock_institucional import es_alumno, obtener_datos_por_correo

ROL_LEGIBLE = {'docente': 'Docente', 'colaborador': 'Colaborador', 'admin': 'Administrador'}

from datetime import timedelta


class UsuarioListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        rol = request.query_params.get('rol')
        id_plantel = request.query_params.get('plantel')

        q = request.query_params.get('q', '').strip()

        qs = Usuario.objects.select_related('rol').prefetch_related('planteles_asignados__plantel', 'planteles_asignados__turno').filter(activo=True)
        if rol:
            roles = [r.strip() for r in rol.split(',') if r.strip()]
            qs = qs.filter(rol__nombre_rol__in=roles)
        if id_plantel:
            turno_param = request.query_params.get('turno')
            qs = qs.filter(Exists(UsuarioPlantel.match(id_plantel, turno_param)))
        excluir_roles = [r.strip() for r in request.query_params.get('excluir', '').split(',') if r.strip()]
        if excluir_roles:
            qs = qs.exclude(rol__nombre_rol__in=excluir_roles)
        if q:
            qs = qs.filter(Q(nombre__icontains=q) | Q(correo__icontains=q))[:20]

        # Con filtro de plantel solo se exponen las asignaciones de ese plantel:
        return Response([{
            'id':      u.id_usuario,
            'nombre':  u.nombre or u.correo,
            'correo':  u.correo,
            'planteles': [
                {'plantel': up.plantel.nombre, 'turno': up.turno.nombre_turno}
                for up in u.planteles_asignados.all()
                if not id_plantel or str(up.plantel_id) == str(id_plantel)
            ],
            'rol':       u.rol.nombre_rol,
            'agrupacion': {
                'id': str(u.agrupacion.id_agrupacion),
                'nombre': u.agrupacion.nombre,
            } if u.agrupacion_id else None,
        } for u in qs])


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
            {'id': p.id_plantel, 'nombre': p.nombre, 'agrupacion_id': str(p.agrupacion_id) if p.agrupacion_id else None}
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


class CrearAdminView(APIView):
    """Superusuario da de alta un admin (con plantel y turno) o un colaborador
    (gestión global, sin plantel ni turno). También director_departamento y
    subdirector_departamento (alcance por agrupación)."""
    permission_classes = [permissions.AllowAny]

    ROLES_ALTA = ('admin', 'colaborador', 'director_departamento', 'subdirector_departamento')

    def post(self, request):
        superadmin = _usuario_sesion(request)
        if not superadmin or superadmin.rol.nombre_rol != 'superusuario':
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        correo = (request.data.get('correo') or '').strip()
        nombre = (request.data.get('nombre') or '').strip()
        plantel_id = request.data.get('plantel_id')
        turno_id = request.data.get('turno_id')
        agrupacion_id = request.data.get('agrupacion_id')
        rol_acceso = (request.data.get('rol') or 'admin').strip()

        if rol_acceso not in self.ROLES_ALTA:
            return Response({'error': 'Rol no válido.'}, status=status.HTTP_400_BAD_REQUEST)
        if not correo:
            return Response({'error': 'correo es requerido.'}, status=status.HTTP_400_BAD_REQUEST)

        plantel = turno = None
        if rol_acceso == 'admin' and plantel_id:
            try:
                plantel = Plantel.objects.get(pk=plantel_id)
                turno = Turno.objects.get(pk=int(turno_id)) if turno_id else None
                if turno is None:
                    turno, _ = Turno.objects.get_or_create(nombre_turno='Matutino')
            except (Plantel.DoesNotExist, Turno.DoesNotExist, TypeError, ValueError):
                return Response({'error': 'Plantel o turno no encontrado.'}, status=status.HTTP_400_BAD_REQUEST)
        elif rol_acceso == 'admin':
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
        elif not Usuario.objects.filter(correo=correo, activo=True).exists():
            # Colaborador sin cuenta local: el correo debe existir en la API
            # institucional y no ser de alumno. No requiere plantel ni turno.
            datos = obtener_datos_por_correo(correo)
            if not datos or es_alumno(datos):
                return Response(
                    {'error': 'Correo no encontrado o corresponde a un alumno.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            if not nombre:
                nombre = (datos.get('nombre') or '').strip()

        try:
            rol_obj = Rol.objects.get(nombre_rol=rol_acceso)
        except Rol.DoesNotExist:
            return Response({'error': f'Rol {rol_acceso} no existe en el catálogo.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        usuario, creado = Usuario.objects.get_or_create(
            correo=correo,
            defaults={'rol': rol_obj, 'nombre': nombre, 'activo': True},
        )
        if not creado:
            usuario.rol = rol_obj
            if nombre:
                usuario.nombre = nombre
            usuario.save(update_fields=['rol', 'nombre'])

        if rol_acceso not in ('director_departamento', 'subdirector_departamento') and usuario.agrupacion_id:
            usuario.agrupacion = None
            usuario.save(update_fields=['agrupacion'])

        UsuarioPlantel.objects.filter(usuario=usuario).delete()
        if rol_acceso == 'admin':
            UsuarioPlantel.objects.create(usuario=usuario, plantel=plantel, turno=turno)

        agrupacion_obj = None
        if rol_acceso in ('director_departamento', 'subdirector_departamento') and agrupacion_id:
            try:
                agrupacion_obj = Agrupacion.objects.get(pk=agrupacion_id)
            except Agrupacion.DoesNotExist:
                return Response(
                    {'error': 'Agrupación no encontrada.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            existe = Usuario.objects.filter(
                rol__nombre_rol=rol_acceso, agrupacion_id=agrupacion_id, activo=True
            )
            if not creado:
                existe = existe.exclude(pk=usuario.pk)
            if existe.exists():
                return Response(
                    {'error': f'Ya existe un {rol_acceso} asignado a esa agrupación.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            usuario.agrupacion = agrupacion_obj
            usuario.save(update_fields=['agrupacion'])

        return Response({
            'id_usuario': usuario.id_usuario,
            'nombre': usuario.nombre or '',
            'correo': usuario.correo,
            'rol': rol_acceso,
            'agrupacion': {'id': str(agrupacion_obj.id_agrupacion), 'nombre': agrupacion_obj.nombre} if agrupacion_obj else None,
            'plantel': plantel.nombre if plantel else None,
            'turno': turno.nombre_turno.lower() if turno else None,
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
        agrupacion_id = request.data.get('agrupacion_id')
        nombre = (request.data.get('nombre') or '').strip()
        nuevo_rol = request.data.get('rol')

        es_otro_usuario = usuario.pk != superadmin.pk

        if nuevo_rol in ('docente', 'colaborador', 'admin', 'director_departamento', 'subdirector_departamento'):
            try:
                rol_obj = Rol.objects.get(nombre_rol=nuevo_rol)
            except Rol.DoesNotExist:
                return Response({'error': 'Rol no válido.'}, status=status.HTTP_400_BAD_REQUEST)
            if usuario.rol_id != rol_obj.id_rol:
                usuario.rol = rol_obj
                usuario.save(update_fields=['rol'])
            if nuevo_rol in ('colaborador', 'docente', 'admin', 'director_departamento', 'subdirector_departamento'):
                UsuarioPlantel.objects.filter(usuario=usuario).delete()
            if nuevo_rol in ('director_departamento', 'subdirector_departamento'):
                if agrupacion_id:
                    try:
                        agrupacion_obj = Agrupacion.objects.get(pk=agrupacion_id)
                    except Agrupacion.DoesNotExist:
                        return Response({'error': 'Agrupación no encontrada.'}, status=status.HTTP_400_BAD_REQUEST)
                    existe = Usuario.objects.filter(
                        rol__nombre_rol=nuevo_rol, agrupacion_id=agrupacion_id, activo=True
                    ).exclude(pk=usuario.pk)
                    if existe.exists():
                        return Response(
                            {'error': f'Ya existe un {nuevo_rol} asignado a esa agrupación.'},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    usuario.agrupacion = agrupacion_obj
                    usuario.save(update_fields=['agrupacion'])
                else:
                    usuario.agrupacion = None
                    usuario.save(update_fields=['agrupacion'])
            elif usuario.agrupacion_id:
                usuario.agrupacion = None
                usuario.save(update_fields=['agrupacion'])
            if nuevo_rol != 'admin':
                if nombre:
                    Usuario.objects.filter(pk=usuario.pk).update(nombre=nombre)
                return Response({'ok': True, 'rol': nuevo_rol}, status=status.HTTP_200_OK)
        elif nuevo_rol:
            return Response({'error': 'Rol no válido.'}, status=status.HTTP_400_BAD_REQUEST)

        if plantel_id and turno_id:
            try:
                plantel = Plantel.objects.get(pk=plantel_id)
                turno = Turno.objects.get(pk=int(turno_id))
            except (Plantel.DoesNotExist, Turno.DoesNotExist, TypeError, ValueError):
                return Response({'error': 'Plantel o turno no encontrado.'}, status=status.HTTP_400_BAD_REQUEST)
            UsuarioPlantel.objects.filter(usuario=usuario).delete()
            UsuarioPlantel.objects.create(usuario=usuario, plantel=plantel, turno=turno)
            if es_otro_usuario:
                notif.notificar(
                    usuario, Notificacion.CATEGORIA_CUENTA,
                    'Se actualizó tu asignación',
                    f'Ahora estás asignado a {plantel.nombre} · turno {turno.nombre_turno}.',
                    {'url': '/ir/inicio'},
                )

        if nombre:
            Usuario.objects.filter(pk=usuario.pk).update(nombre=nombre)

        return Response({'ok': True}, status=status.HTTP_200_OK)


class AgrupacionListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        agrupaciones = Agrupacion.objects.all().order_by('nombre')
        return Response([
            {
                'id': str(a.id_agrupacion),
                'nombre': a.nombre,
                'parent_id': str(a.parent_id) if a.parent_id else None,
            }
            for a in agrupaciones
        ])


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
            qs = qs.filter(planteles_asignados__plantel_id__in=usuario.ids_planteles()).distinct()
            ambito = 'plantel'

        hace_semana = timezone.now() - timedelta(days=7)
        return Response({
            'ambito': ambito,
            'usuarios_activos': qs.count(),
            'activos_semana': qs.filter(ultima_sesion__gte=hace_semana).count(),
        })
