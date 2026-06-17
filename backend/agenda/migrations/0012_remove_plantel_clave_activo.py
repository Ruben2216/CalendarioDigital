from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0011_alter_solicitudadmin_id_solicitud_admin'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='plantel',
            name='clave',
        ),
        migrations.RemoveField(
            model_name='plantel',
            name='activo',
        ),
    ]
