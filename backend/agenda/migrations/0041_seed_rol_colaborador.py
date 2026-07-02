from django.db import migrations


def insertar_rol_colaborador(apps, schema_editor):
    ex = schema_editor.execute

    ex("SET IDENTITY_INSERT Rol ON")
    ex("INSERT INTO Rol (id_rol, nombre_rol) VALUES (5, 'colaborador')")
    ex("SET IDENTITY_INSERT Rol OFF")


def eliminar_rol_colaborador(apps, schema_editor):
    schema_editor.execute("DELETE FROM Rol WHERE id_rol = 5")


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0040_remove_dispositivofcm_plantel'),
    ]

    operations = [
        migrations.RunPython(insertar_rol_colaborador, eliminar_rol_colaborador),
    ]
