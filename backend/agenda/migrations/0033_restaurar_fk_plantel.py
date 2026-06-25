from django.db import migrations


FK_SQL = [
    # (tabla, constraint_name, on_delete_action)
    ('UsuarioPlantel', 'FK_UsuarioPlantel_plantel', 'CASCADE'),
    ('TipoEvento',     'FK_TipoEvento_plantel',     'CASCADE'),
    ('Evento',         'FK_Evento_plantel',          'CASCADE'),
    ('Anuncio',        'FK_Anuncio_plantel',         'CASCADE'),
    ('Conversacion',   'FK_Conversacion_plantel',    'CASCADE'),
    ('Notificacion',   'FK_Notificacion_plantel',    'CASCADE'),
    ('SolicitudAdmin', 'FK_SolicitudAdmin_plantel',  'SET NULL'),
    ('DispositivoFCM', 'FK_DispositivoFCM_plantel',  'SET NULL'),
]


def agregar_fks(apps, schema_editor):
    from django.db import connection
    with connection.cursor() as cursor:
        for tabla, nombre, accion in FK_SQL:
            cursor.execute(f"""
                ALTER TABLE [{tabla}]
                ADD CONSTRAINT [{nombre}]
                FOREIGN KEY ([plantel_id])
                REFERENCES [Plantel] ([id_plantel])
                ON DELETE {accion};
            """)


def eliminar_fks(apps, schema_editor):
    from django.db import connection
    with connection.cursor() as cursor:
        for tabla, nombre, _ in FK_SQL:
            cursor.execute(f"""
                IF EXISTS (
                    SELECT 1 FROM sys.foreign_keys
                    WHERE name = '{nombre}' AND parent_object_id = OBJECT_ID('{tabla}')
                )
                ALTER TABLE [{tabla}] DROP CONSTRAINT [{nombre}];
            """)


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0032_reconciliar_plantel'),
    ]

    operations = [
        migrations.RunPython(agregar_fks, eliminar_fks),
    ]
