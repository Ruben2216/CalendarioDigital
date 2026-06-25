import uuid

from django.db import migrations

import agenda.fields


class Migration(migrations.Migration):
    dependencies = [
        ('agenda', '0033_restaurar_fk_plantel'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AlterField(
                    model_name='plantel',
                    name='id_plantel',
                    field=agenda.fields.UniqueIdentifierField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
            ],
        ),
    ]
