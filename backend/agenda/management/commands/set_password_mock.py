import secrets

from django.core.management.base import BaseCommand, CommandError

from agenda.models import Usuario


class Command(BaseCommand):
    help = 'Asigna una contraseña local hasheada (password_mock) a un usuario, o la elimina'

    def add_arguments(self, parser):
        parser.add_argument('correo', help='Correo del usuario en la BD local')
        parser.add_argument(
            '--password',
            help='Contraseña a asignar; si se omite se genera una aleatoria segura',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Elimina la contraseña local (queda NULL y el login local se deshabilita)',
        )

    def handle(self, *args, **options):
        try:
            usuario = Usuario.objects.select_related('rol').get(correo=options['correo'])
        except Usuario.DoesNotExist:
            raise CommandError(f"No existe un usuario con correo {options['correo']}.")

        if options['clear']:
            Usuario.objects.filter(pk=usuario.pk).update(password_mock=None)
            self.stdout.write(self.style.SUCCESS(f'Contraseña local eliminada para {usuario.correo}.'))
            return

        password = options['password'] or secrets.token_urlsafe(16)
        usuario.asignar_password_mock(password)

        self.stdout.write(self.style.SUCCESS(f'Contraseña local actualizada para {usuario.correo}.'))
        if not options['password']:
            self.stdout.write('Contraseña generada (guárdala ahora, no se puede recuperar):')
            self.stdout.write(self.style.WARNING(password))
