import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0037_notificacion_turno'),
    ]

    operations = [
        migrations.AddField(
            model_name='googleoauthcredential',
            name='semestre',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='credenciales_google', to='agenda.semestre',
            ),
        ),
        migrations.AddField(
            model_name='googleoauthcredential',
            name='grupo',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='credenciales_google', to='agenda.grupo',
            ),
        ),
    ]
