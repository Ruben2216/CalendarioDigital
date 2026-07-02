from django.db import migrations


def limpiar_asignaciones_colaborador(apps, schema_editor):
    """Los colaboradores no gestionan por plantel: se elimina la asignación
    heredada de su rol anterior para que el login re-sincronice su adscripción
    institucional original."""
    UsuarioPlantel = apps.get_model('agenda', 'UsuarioPlantel')
    UsuarioPlantel.objects.filter(usuario__rol__nombre_rol='colaborador').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0041_seed_rol_colaborador'),
        ('agenda', '0041_evento_publico'),
    ]

    operations = [
        migrations.RunPython(limpiar_asignaciones_colaborador, migrations.RunPython.noop),
    ]
