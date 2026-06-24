from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0027_googleoauthcredential_email_google'),
    ]

    operations = [
        migrations.DeleteModel(
            name='PermisoEspecial',
        ),
    ]
