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
