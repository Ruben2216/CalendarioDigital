from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0012_remove_plantel_clave_activo'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterUniqueTogether(
                    name='turno',
                    unique_together=set(),
                ),
            ],
            database_operations=[],
        ),
        migrations.RemoveField(
            model_name='turno',
            name='plantel',
        ),
        migrations.AlterField(
            model_name='turno',
            name='nombre_turno',
            field=models.CharField(max_length=30, unique=True),
        ),
    ]
