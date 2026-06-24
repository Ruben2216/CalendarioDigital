import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0028_conversacion_check_orden_participantes'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='solicitudadmin',
            name='nombre',
        ),
        migrations.RemoveField(
            model_name='solicitudadmin',
            name='correo',
        ),
        migrations.RemoveField(
            model_name='solicitudadmin',
            name='plantel',
        ),
        migrations.RemoveField(
            model_name='solicitudadmin',
            name='turno',
        ),
        migrations.AddField(
            model_name='solicitudadmin',
            name='plantel',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='solicitudes_admin',
                to='agenda.plantel',
            ),
        ),
        migrations.AddField(
            model_name='solicitudadmin',
            name='turno',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='solicitudes_admin',
                to='agenda.turno',
            ),
        ),
    ]
