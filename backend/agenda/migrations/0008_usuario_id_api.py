from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0007_alter_conversacion_id_conversacion_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='usuario',
            name='id_api',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
    ]
