from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0009_alter_conversacion_id_conversacion_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql="EXEC sp_rename '[SolicitudAdmin].[id]', 'id_solicitud_admin', 'COLUMN';",
            reverse_sql="EXEC sp_rename '[SolicitudAdmin].[id_solicitud_admin]', 'id', 'COLUMN';",
            state_operations=[
                migrations.RenameField(
                    model_name='solicitudadmin',
                    old_name='id',
                    new_name='id_solicitud_admin',
                ),
            ],
        ),
    ]
