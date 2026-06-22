from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('agenda', '0022_alter_notificacion_options_and_more'),
    ]

    operations = [
        migrations.DeleteModel(name='Notificacion'),
        migrations.CreateModel(
            name='Notificacion',
            fields=[
                ('id_notificacion', models.BigAutoField(primary_key=True, serialize=False)),
                ('categoria', models.CharField(choices=[('anuncio', 'Anuncio'), ('evento', 'Evento')], default='anuncio', max_length=20)),
                ('titulo', models.CharField(max_length=200)),
                ('mensaje', models.TextField(blank=True, default='')),
                ('audiencia', models.CharField(default='todos', max_length=20)),
                ('plantel', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='notificaciones', to='agenda.plantel')),
                ('referencia_id', models.BigIntegerField(blank=True, null=True)),
                ('fecha_creacion', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'Notificacion',
                'ordering': ['-fecha_creacion'],
            },
        ),
    ]
