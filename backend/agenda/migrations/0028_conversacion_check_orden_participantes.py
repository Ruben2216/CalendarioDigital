from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0027_googleoauthcredential_email_google'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='conversacion',
            constraint=models.CheckConstraint(
                condition=models.Q(participante_a_id__lt=models.F('participante_b_id')),
                name='chk_conversacion_orden_participantes',
            ),
        ),
    ]
