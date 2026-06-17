from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0010_solicitudadmin_id_solicitud_admin'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterField(
                    model_name='solicitudadmin',
                    name='id_solicitud_admin',
                    field=models.BigAutoField(primary_key=True, serialize=False),
                ),
            ],
            database_operations=[],
        ),
    ]
