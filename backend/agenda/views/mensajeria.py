from django.db.models import Exists, Q

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from ._comunes import _usuario_sesion
from ..models import Conversacion, LecturaMensaje, Mensaje, Plantel, Usuario, UsuarioPlantel


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
                rol__nombre_rol='docente', planteles_asignados__plantel_id__in=usuario.ids_planteles(), activo=True
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

        rol_usuario = usuario.rol.nombre_rol
        rol_otro = otro.rol.nombre_rol

        # El superusuario puede hablar con todos; cualquiera puede hablar con el superusuario.
        if rol_usuario != 'superusuario' and rol_otro != 'superusuario':
            planteles_usuario = set(usuario.ids_planteles())
            planteles_otro = set(otro.ids_planteles())
            if not planteles_usuario.intersection(planteles_otro):
                return Response(
                    {'error': 'No puedes contactar usuarios de otro plantel.'},
                    status=status.HTTP_403_FORBIDDEN,
                )

        id_a, id_b = Conversacion.par_ordenado(usuario.id_usuario, otro.id_usuario)

        # Plantel para la conversación: en común si existe, si no el del docente, si no el primero disponible
        planteles_usuario = set(usuario.ids_planteles())
        planteles_otro = set(otro.ids_planteles())
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
            ids = (
                Usuario.objects
                .filter(rol__nombre_rol='admin', activo=True)
                .filter(Exists(UsuarioPlantel.match(up.plantel_id, up.turno.nombre_turno)))
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

        # UsuarioPlantel.match garantiza que plantel_id y turno estén en el MISMO registro.
        destinatarios = list(
            Usuario.objects.filter(
                rol__nombre_rol='admin',
                activo=True,
            ).filter(Exists(UsuarioPlantel.match(id_plantel, turno_buscado)))
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
