from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0026_multi_user_google_sync'),
    ]

    operations = [
        migrations.AddField(
            model_name='googleoauthcredential',
            name='email_google',
            field=models.EmailField(blank=True, max_length=254, null=True),
        ),
    ]
