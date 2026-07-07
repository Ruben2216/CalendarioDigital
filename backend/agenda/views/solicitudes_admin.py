from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from ._comunes import _usuario_sesion
from ..models import Plantel, Rol, SolicitudAdmin, Turno, UsuarioPlantel


def _solicitud_dict(s):
    return {
        'id': s.id_solicitud_admin,
        'id_usuario': s.usuario_id,
        'nombre': s.usuario.nombre,
        'correo': s.usuario.correo,
        'tipo': s.tipo,
        'plantel': s.plantel.nombre if s.plantel else '',
        'plantel_id': s.plantel_id,
        'turno': s.turno.nombre_turno.lower() if s.turno else '',
        'turno_id': s.turno_id,
        'motivo': s.motivo,
        'estado': s.estado,
        'fecha_solicitud': s.fecha_solicitud.isoformat(),
    }


def _ids_planteles_usuario(usuario):
    return set(
        UsuarioPlantel.objects.filter(usuario=usuario).values_list('plantel_id', flat=True)
    )


def _puede_resolver(admin, solicitud):
    """Superusuario resuelve cualquier solicitud. El admin resuelve las de tipo
    admin (comportamiento original) y las de visualización/turno solo si el
    plantel de la solicitud es uno de los suyos."""
    rol = admin.rol.nombre_rol
    if rol == 'superusuario':
        return True
    if rol != 'admin':
        return False
    if solicitud.tipo == SolicitudAdmin.TIPO_ADMIN:
        return True
    return solicitud.plantel_id in set(admin.ids_planteles())


class SolicitudAdminView(APIView):
    """Crea solicitudes (docente/administrativo) y las lista (admin/superusuario)."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        usuario = _usuario_sesion(request)
        if not usuario or usuario.rol.nombre_rol not in ('admin', 'superusuario'):
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        qs = SolicitudAdmin.objects.select_related('usuario', 'plantel', 'turno')

        estado = request.query_params.get('estado')
        if estado:
            qs = qs.filter(estado=estado)

        tipos = [t.strip() for t in (request.query_params.get('tipo') or '').split(',') if t.strip()]
        if tipos:
            qs = qs.filter(tipo__in=tipos)

        # El admin solo ve solicitudes dirigidas a sus planteles.
        if usuario.rol.nombre_rol == 'admin':
            qs = qs.filter(plantel_id__in=usuario.ids_planteles())

        return Response([_solicitud_dict(s) for s in qs])

    def post(self, request):
        usuario = _usuario_sesion(request)
        if not usuario:
            return Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)

        tipo = (request.data.get('tipo') or SolicitudAdmin.TIPO_ADMIN).strip()
        if tipo not in dict(SolicitudAdmin.TIPOS):
            return Response({'error': 'Tipo de solicitud inválido.'}, status=status.HTTP_400_BAD_REQUEST)

        # Si ya tiene una solicitud pendiente de este tipo, se devuelve esa misma
        # (con ya_existe=True) en lugar de crear otra.
        existente = SolicitudAdmin.objects.filter(
            usuario=usuario, tipo=tipo, estado=SolicitudAdmin.ESTADO_PENDIENTE
        ).select_related('usuario', 'plantel', 'turno').first()
        if existente:
            return Response(
                {'ya_existe': True, 'solicitud': _solicitud_dict(existente)},
                status=status.HTTP_200_OK,
            )

        plantel_nombre = (request.data.get('plantel') or '').strip()
        plantel_obj = Plantel.objects.filter(nombre__iexact=plantel_nombre).first() if plantel_nombre else None

        turno_nombre = (request.data.get('turno') or '').strip()
        turno_obj = Turno.objects.filter(nombre_turno__iexact=turno_nombre).first() if turno_nombre else None

        if tipo in (SolicitudAdmin.TIPO_VISUALIZACION, SolicitudAdmin.TIPO_TURNO):
            if not plantel_obj or not turno_obj:
                return Response({'error': 'Plantel y turno son requeridos.'}, status=status.HTTP_400_BAD_REQUEST)

            asignados = _ids_planteles_usuario(usuario)
            if tipo == SolicitudAdmin.TIPO_VISUALIZACION:
                if plantel_obj.id_plantel in asignados:
                    return Response({'error': 'Ese plantel ya está en tus asignaciones.'}, status=status.HTTP_400_BAD_REQUEST)
                if len(asignados) >= SolicitudAdmin.LIMITE_PLANTELES:
                    return Response(
                        {'error': f'Ya tienes el límite de {SolicitudAdmin.LIMITE_PLANTELES} planteles asignados.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            else:
                if plantel_obj.id_plantel not in asignados:
                    return Response(
                        {'error': 'Solo puedes solicitar cambio de turno en un plantel que tengas asignado.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                ya_tiene_turno = UsuarioPlantel.objects.filter(
                    usuario=usuario, plantel=plantel_obj, turno=turno_obj
                ).exists()
                if ya_tiene_turno:
                    return Response({'error': 'Ya tienes ese turno en ese plantel.'}, status=status.HTTP_400_BAD_REQUEST)

        solicitud = SolicitudAdmin.objects.create(
            usuario=usuario,
            tipo=tipo,
            plantel=plantel_obj,
            turno=turno_obj,
            motivo=(request.data.get('motivo') or '').strip(),
        )
        return Response(
            {'ya_existe': False, 'solicitud': _solicitud_dict(solicitud)},
            status=status.HTTP_201_CREATED,
        )


class MiSolicitudAdminView(APIView):
    """Devuelve la solicitud pendiente del usuario actual (o null), por tipo."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        usuario = _usuario_sesion(request)
        if not usuario:
            return Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)
        qs = SolicitudAdmin.objects.filter(
            usuario=usuario, estado=SolicitudAdmin.ESTADO_PENDIENTE
        ).select_related('usuario', 'plantel', 'turno')
        tipo = (request.query_params.get('tipo') or '').strip()
        if tipo:
            qs = qs.filter(tipo=tipo)
        solicitud = qs.first()
        return Response({'solicitud': _solicitud_dict(solicitud) if solicitud else None})


class ResolverSolicitudAdminView(APIView):
    """Acepta, rechaza, revoca, edita o elimina una solicitud. Al aceptar:
    - tipo admin: el usuario pasa a rol admin con el plantel/turno solicitados.
    - tipo visualizacion: se agrega el plantel a sus asignaciones (límite 2).
    - tipo turno: se actualiza el turno de su asignación en ese plantel.
    Revocar solo aplica a una visualizacion ya aceptada: quita el UsuarioPlantel
    correspondiente, así el usuario deja de ver el calendario de ese plantel."""
    permission_classes = [permissions.AllowAny]

    def post(self, request, id_solicitud):
        admin = _usuario_sesion(request)
        if not admin or admin.rol.nombre_rol not in ('admin', 'superusuario'):
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            solicitud = SolicitudAdmin.objects.select_related('usuario', 'plantel', 'turno').get(pk=id_solicitud)
        except SolicitudAdmin.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if not _puede_resolver(admin, solicitud):
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        accion = request.data.get('accion')
        if accion not in ('aceptar', 'rechazar', 'revocar'):
            return Response({'error': 'Acción inválida.'}, status=status.HTTP_400_BAD_REQUEST)

        if accion == 'revocar':
            if solicitud.tipo != SolicitudAdmin.TIPO_VISUALIZACION:
                return Response(
                    {'error': 'Solo se puede revocar una visualización de plantel.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if solicitud.estado != SolicitudAdmin.ESTADO_ACEPTADA:
                return Response({'error': 'La solicitud no está aceptada.'}, status=status.HTTP_409_CONFLICT)

            UsuarioPlantel.objects.filter(usuario=solicitud.usuario, plantel=solicitud.plantel).delete()
            solicitud.estado = SolicitudAdmin.ESTADO_REVOCADA
        elif solicitud.estado != SolicitudAdmin.ESTADO_PENDIENTE:
            return Response({'error': 'La solicitud ya fue resuelta.'}, status=status.HTTP_409_CONFLICT)
        elif accion == 'aceptar':
            error = self._aplicar(solicitud)
            if error:
                return error
            solicitud.estado = SolicitudAdmin.ESTADO_ACEPTADA
        else:
            solicitud.estado = SolicitudAdmin.ESTADO_RECHAZADA

        solicitud.resuelta_por = admin
        solicitud.fecha_resolucion = timezone.now()
        solicitud.save(update_fields=['estado', 'resuelta_por', 'fecha_resolucion'])

        return Response({'solicitud': _solicitud_dict(solicitud)}, status=status.HTTP_200_OK)

    def _aplicar(self, solicitud):
        """Aplica el efecto de aceptar la solicitud. Devuelve un Response de
        error o None si todo salió bien."""
        usuario = solicitud.usuario

        if solicitud.tipo == SolicitudAdmin.TIPO_ADMIN:
            try:
                rol_admin = Rol.objects.get(nombre_rol='admin')
            except Rol.DoesNotExist:
                return Response(
                    {'error': 'No existe el rol admin en el catálogo.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            usuario.rol = rol_admin
            usuario.save(update_fields=['rol'])
            # Crear entrada UsuarioPlantel con el plantel/turno de la solicitud
            if solicitud.plantel_id and solicitud.turno_id:
                UsuarioPlantel.objects.filter(usuario=usuario).delete()
                UsuarioPlantel.objects.create(usuario=usuario, plantel=solicitud.plantel, turno=solicitud.turno)
            return None

        if not solicitud.plantel_id or not solicitud.turno_id:
            return Response({'error': 'La solicitud no tiene plantel o turno.'}, status=status.HTTP_400_BAD_REQUEST)

        asignados = _ids_planteles_usuario(usuario)

        if solicitud.tipo == SolicitudAdmin.TIPO_VISUALIZACION:
            if solicitud.plantel_id not in asignados and len(asignados) >= SolicitudAdmin.LIMITE_PLANTELES:
                return Response(
                    {'error': f'El usuario ya tiene el límite de {SolicitudAdmin.LIMITE_PLANTELES} planteles asignados.'},
                    status=status.HTTP_409_CONFLICT,
                )
        else:  # TIPO_TURNO
            if solicitud.plantel_id not in asignados:
                return Response(
                    {'error': 'El usuario ya no está asignado a ese plantel.'},
                    status=status.HTTP_409_CONFLICT,
                )

        # Un solo turno por plantel: se reemplaza la asignación de ese plantel.
        UsuarioPlantel.objects.filter(usuario=usuario, plantel=solicitud.plantel).delete()
        UsuarioPlantel.objects.create(usuario=usuario, plantel=solicitud.plantel, turno=solicitud.turno)
        return None

    def patch(self, request, id_solicitud):
        """Edita el plantel/turno de una solicitud pendiente antes de resolverla."""
        admin = _usuario_sesion(request)
        if not admin or admin.rol.nombre_rol not in ('admin', 'superusuario'):
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            solicitud = SolicitudAdmin.objects.select_related('usuario', 'plantel', 'turno').get(pk=id_solicitud)
        except SolicitudAdmin.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if not _puede_resolver(admin, solicitud):
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        if solicitud.estado != SolicitudAdmin.ESTADO_PENDIENTE:
            return Response({'error': 'La solicitud ya fue resuelta.'}, status=status.HTTP_409_CONFLICT)

        campos = []
        plantel_id = request.data.get('plantel_id')
        if plantel_id:
            try:
                solicitud.plantel = Plantel.objects.get(pk=plantel_id)
            except Plantel.DoesNotExist:
                return Response({'error': 'Plantel no encontrado.'}, status=status.HTTP_400_BAD_REQUEST)
            campos.append('plantel')

        turno_id = request.data.get('turno_id')
        if turno_id:
            try:
                solicitud.turno = Turno.objects.get(pk=int(turno_id))
            except (Turno.DoesNotExist, TypeError, ValueError):
                return Response({'error': 'Turno no encontrado.'}, status=status.HTTP_400_BAD_REQUEST)
            campos.append('turno')

        if campos:
            solicitud.save(update_fields=campos)

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

        if not _puede_resolver(admin, solicitud):
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        solicitud.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
