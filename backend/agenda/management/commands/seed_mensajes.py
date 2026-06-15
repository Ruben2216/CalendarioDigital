from django.core.management.base import BaseCommand

from agenda.models import Conversacion, Mensaje, Usuario


class Command(BaseCommand):
    help = 'Siembra mensajes de prueba cifrados'

    def handle(self, *args, **kwargs):
        try:
            docente = Usuario.objects.get(correo='ruben.docente@cobach.edu.mx')
            admin = Usuario.objects.get(correo='ruben.admin@cobach.edu.mx')
        except Usuario.DoesNotExist as e:
            self.stderr.write(f'Usuario no encontrado: {e}. Ejecuta loaddata primero.')
            return

        id_a, id_b = Conversacion.par_ordenado(docente.id_usuario, admin.id_usuario)
        conv, creada = Conversacion.objects.get_or_create(
            participante_a_id=id_a,
            participante_b_id=id_b,
            defaults={'plantel': admin.plantel},
        )

        if not creada and conv.mensajes.exists():
            self.stdout.write(self.style.WARNING('La conversación ya tiene mensajes, omitiendo seed.'))
            return

        Mensaje.crear(
            conv, docente,
            'Buen día, solicito el audiovisual para el miércoles 17 de junio, '
            '10:00–12:00 hrs, para exposición de proyectos del grupo 3-A matutino.',
            metadatos={
                'tipo': 'solicitud_espacio',
                'titulo': 'Solicitud de espacio',
                'icono': 'calendario',
                'campos': [
                    {'clave': 'Fecha',   'valor': 'Miércoles 17 jun 2026'},
                    {'clave': 'Horario', 'valor': '10:00 – 12:00 hrs'},
                    {'clave': 'Grupo',   'valor': '3-A Matutino'},
                    {'clave': 'Recurso', 'valor': 'Audiovisual + Cañón'},
                ],
            },
        )

        Mensaje.crear(
            conv, admin,
            'Buenos días, Rubén. El horario 10:00–12:00 está libre. '
            'Solicitud aprobada, el evento ya aparece en el calendario institucional.',
            metadatos={
                'tipo': 'solicitud_aprobada',
                'titulo': 'Solicitud aprobada',
                'icono': 'check',
                'campos': [
                    {'clave': 'Estado',        'valor': 'Aprobada'},
                    {'clave': 'Registrado en', 'valor': 'Calendario institucional'},
                ],
            },
        )

        self.stdout.write(self.style.SUCCESS('Mensajes de prueba creados correctamente.'))
