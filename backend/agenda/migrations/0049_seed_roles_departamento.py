from django.db import migrations


def insertar_roles(apps, schema_editor):
    Rol = apps.get_model('agenda', 'Rol')
    if not Rol.objects.filter(nombre_rol='director_departamento').exists():
        Rol.objects.create(id_rol=6, nombre_rol='director_departamento')
    if not Rol.objects.filter(nombre_rol='subdirector_departamento').exists():
        Rol.objects.create(id_rol=7, nombre_rol='subdirector_departamento')


def eliminar_roles(apps, schema_editor):
    Rol = apps.get_model('agenda', 'Rol')
    Rol.objects.filter(nombre_rol__in=['director_departamento', 'subdirector_departamento']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0048_agrupacion_parent'),
    ]

    operations = [
        migrations.RunPython(insertar_roles, eliminar_roles),
    ]
