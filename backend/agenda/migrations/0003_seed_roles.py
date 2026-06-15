from django.db import migrations


def insertar_roles(apps, schema_editor):
    ex = schema_editor.execute

    ex("SET IDENTITY_INSERT Rol ON")
    ex("INSERT INTO Rol (id_rol, nombre_rol) VALUES (3, '__docente_tmp__')")
    ex("SET IDENTITY_INSERT Rol OFF")

    ex("UPDATE Usuario SET rol_id = 3 WHERE rol_id = 1")

    ex("UPDATE Rol SET nombre_rol = 'superusuario' WHERE id_rol = 1")
    ex("UPDATE Rol SET nombre_rol = 'docente'      WHERE id_rol = 3")

    ex("SET IDENTITY_INSERT Rol ON")
    ex("INSERT INTO Rol (id_rol, nombre_rol) VALUES (4, 'alumno')")
    ex("SET IDENTITY_INSERT Rol OFF")


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0002_usuario_ultima_sesion'),
    ]

    operations = [
        migrations.RunPython(insertar_roles, migrations.RunPython.noop),
    ]
