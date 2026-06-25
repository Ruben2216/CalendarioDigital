import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    """
    La BD ya tiene Plantel(id_plantel UNIQUEIDENTIFIER, clave NVARCHAR(10), nombre NVARCHAR(250)).
    Esta migración solo sincroniza el estado de Django con esa realidad, sin ejecutar DDL.
    """

    dependencies = [
        ('agenda', '0031_merge_20260625_0918'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AlterField(
                    model_name='plantel',
                    name='id_plantel',
                    field=models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                migrations.AddField(
                    model_name='plantel',
                    name='clave',
                    field=models.CharField(max_length=10, unique=True, default=''),
                    preserve_default=False,
                ),
                migrations.AlterField(
                    model_name='plantel',
                    name='nombre',
                    field=models.CharField(max_length=250),
                ),
            ],
        ),
    ]
