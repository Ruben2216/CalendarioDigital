from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0006_remove_notificacion_id_notificacion_id_notificacion'),
    ]

    operations = [
        migrations.AddField(
            model_name='usuario',
            name='id_api',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
    ]
