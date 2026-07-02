from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0040_remove_dispositivofcm_plantel'),
    ]

    operations = [
        migrations.AddField(
            model_name='evento',
            name='publico',
            field=models.BooleanField(null=True, blank=True, default=None),
        ),
    ]
