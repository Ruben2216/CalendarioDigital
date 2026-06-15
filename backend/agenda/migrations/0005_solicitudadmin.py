import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0004_notificacion'),
    ]

    operations = [
        migrations.CreateModel(
            name='SolicitudAdmin',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=150)),
                ('correo', models.CharField(max_length=100)),
                ('plantel', models.CharField(blank=True, default='', max_length=100)),
                ('turno', models.CharField(blank=True, default='', max_length=30)),
                ('motivo', models.TextField(blank=True, default='')),
                ('estado', models.CharField(choices=[('pendiente', 'Pendiente'), ('aceptada', 'Aceptada'), ('rechazada', 'Rechazada')], default='pendiente', max_length=20)),
                ('fecha_solicitud', models.DateTimeField(auto_now_add=True)),
                ('fecha_resolucion', models.DateTimeField(blank=True, null=True)),
                ('usuario', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='solicitudes_admin', to='agenda.usuario')),
                ('resuelta_por', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='solicitudes_resueltas', to='agenda.usuario')),
            ],
            options={
                'db_table': 'SolicitudAdmin',
                'ordering': ['-fecha_solicitud'],
            },
        ),
    ]
