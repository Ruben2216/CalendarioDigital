from django.db import migrations, models


RENOMBRES = [
    ('Conversacion', 'id_conversacion'),
    ('Grupo', 'id_grupo'),
    ('LecturaMensaje', 'id_lectura_mensaje'),
    ('Mensaje', 'id_mensaje'),
    ('PermisoEspecial', 'id_permiso_especial'),
    ('Plantel', 'id_plantel'),
    ('Rol', 'id_rol'),
    ('Turno', 'id_turno'),
    ('Usuario', 'id_usuario'),
]

SQL_RENOMBRAR = '\n'.join(
    f"EXEC sp_rename '[{tabla}].[id]', '{columna}', 'COLUMN';"
    for tabla, columna in RENOMBRES
)
SQL_REVERTIR = '\n'.join(
    f"EXEC sp_rename '[{tabla}].[{columna}]', 'id', 'COLUMN';"
    for tabla, columna in RENOMBRES
)

ESTADO = [
    migrations.AlterField(
        model_name=modelo,
        name=columna,
        field=models.BigAutoField(primary_key=True, serialize=False),
    )
    for modelo, columna in [
        ('conversacion', 'id_conversacion'),
        ('grupo', 'id_grupo'),
        ('lecturamensaje', 'id_lectura_mensaje'),
        ('mensaje', 'id_mensaje'),
        ('permisoespecial', 'id_permiso_especial'),
        ('plantel', 'id_plantel'),
        ('rol', 'id_rol'),
        ('turno', 'id_turno'),
        ('usuario', 'id_usuario'),
    ]
]


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0008_usuario_id_api'),
    ]

    operations = [
        migrations.RunSQL(
            sql=SQL_RENOMBRAR,
            reverse_sql=SQL_REVERTIR,
            state_operations=ESTADO,
        ),
    ]
