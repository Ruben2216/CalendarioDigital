import django.db.models.deletion
from django.db import migrations, models

def vincular_referencias(apps, schema_editor):
    Notificacion = apps.get_model('agenda', 'Notificacion')
    Anuncio = apps.get_model('agenda', 'Anuncio')
    Evento = apps.get_model('agenda', 'Evento')

    ids_anuncio = set(Anuncio.objects.values_list('id_anuncio', flat=True))
    ids_evento = set(Evento.objects.values_list('id_evento', flat=True))

    for n in Notificacion.objects.exclude(referencia_id__isnull=True):
        if n.categoria == 'anuncio' and n.referencia_id in ids_anuncio:
            n.anuncio_id = n.referencia_id
            n.save(update_fields=['anuncio'])
        elif n.categoria == 'evento' and n.referencia_id in ids_evento:
            n.evento_id = n.referencia_id
            n.save(update_fields=['evento'])

def restaurar_referencias(apps, schema_editor):
    Notificacion = apps.get_model('agenda', 'Notificacion')
    for n in Notificacion.objects.all():
        ref = n.evento_id or n.anuncio_id
        if ref:
            n.referencia_id = ref
            n.save(update_fields=['referencia_id'])

class Migration(migrations.Migration):
    dependencies = [
        ('agenda', '0029_solicitudadmin_plantel_fk'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='dispositivofcm',
            name='id_externo',
        ),
        migrations.RemoveField(
            model_name='dispositivofcm',
            name='rol',
        ),
        
        migrations.AddField(
            model_name='notificacion',
            name='anuncio',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='notificaciones', to='agenda.anuncio'),
        ),
        migrations.AddField(
            model_name='notificacion',
            name='evento',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='notificaciones', to='agenda.evento'),
        ),
        migrations.RunPython(vincular_referencias, restaurar_referencias),

        migrations.RemoveField(
            model_name='notificacion',
            name='referencia_id',
        ),
    ]
