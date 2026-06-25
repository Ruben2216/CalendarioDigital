import django.db.models.deletion
from django.db import migrations, models


def seed_catalogos(apps, schema_editor):
    Semestre = apps.get_model('agenda', 'Semestre')
    Letra = apps.get_model('agenda', 'Letra')
    for i in range(1, 7):
        Semestre.objects.get_or_create(id_semestre=i)
    for l in 'ABCDEFGHIJ':
        Letra.objects.get_or_create(id_letra=l)


def seed_grupos(apps, schema_editor):
    Semestre = apps.get_model('agenda', 'Semestre')
    Letra = apps.get_model('agenda', 'Letra')
    Grupo = apps.get_model('agenda', 'Grupo')
    for s in Semestre.objects.all():
        for l in Letra.objects.all():
            Grupo.objects.get_or_create(semestre=s, letra=l)


def migrar_eventos(apps, schema_editor):
    Evento = apps.get_model('agenda', 'Evento')
    Semestre = apps.get_model('agenda', 'Semestre')
    Grupo = apps.get_model('agenda', 'Grupo')
    for ev in Evento.objects.all():
        sem = None
        if ev.semestre_raw is not None:
            sem = Semestre.objects.filter(id_semestre=ev.semestre_raw).first()

        grp = None
        if sem and ev.grupo_raw:
            grp = Grupo.objects.filter(
                semestre=sem, letra_id=ev.grupo_raw.strip().upper()
            ).first()

        update_fields = []
        if sem is not None:
            ev.semestre_fk = sem
            update_fields.append('semestre_fk')
        if grp is not None:
            ev.grupo_fk = grp
            update_fields.append('grupo_fk')
        if update_fields:
            ev.save(update_fields=update_fields)


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0033_restaurar_fk_plantel'),
    ]

    operations = [
        # ── 1. Catálogos ──────────────────────────────────────────────────────
        migrations.CreateModel(
            name='Semestre',
            fields=[
                ('id_semestre', models.IntegerField(primary_key=True, serialize=False)),
            ],
            options={'db_table': 'Semestre'},
        ),
        migrations.CreateModel(
            name='Letra',
            fields=[
                ('id_letra', models.CharField(max_length=1, primary_key=True, serialize=False)),
            ],
            options={'db_table': 'Letra'},
        ),
        migrations.RunPython(seed_catalogos, migrations.RunPython.noop),

        # ── 2. Reconstruir Grupo (tabla vacía) ────────────────────────────────
        migrations.DeleteModel(name='Grupo'),
        migrations.CreateModel(
            name='Grupo',
            fields=[
                ('id_grupo', models.BigAutoField(primary_key=True, serialize=False)),
                ('semestre', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='grupos',
                    to='agenda.semestre',
                )),
                ('letra', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='grupos',
                    to='agenda.letra',
                )),
            ],
            options={'db_table': 'Grupo'},
        ),
        migrations.AlterUniqueTogether(
            name='grupo',
            unique_together={('semestre', 'letra')},
        ),
        migrations.RunPython(seed_grupos, migrations.RunPython.noop),

        # ── 3. Evento: campos intermedios para migrar datos ───────────────────
        migrations.RenameField(model_name='evento', old_name='semestre', new_name='semestre_raw'),
        migrations.RenameField(model_name='evento', old_name='grupo',    new_name='grupo_raw'),
        migrations.AddField(
            model_name='evento',
            name='semestre_fk',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='eventos',
                to='agenda.semestre',
            ),
        ),
        migrations.AddField(
            model_name='evento',
            name='grupo_fk',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='eventos',
                to='agenda.grupo',
            ),
        ),
        migrations.RunPython(migrar_eventos, migrations.RunPython.noop),
        migrations.RemoveField(model_name='evento', name='semestre_raw'),
        migrations.RemoveField(model_name='evento', name='grupo_raw'),
        migrations.RenameField(model_name='evento', old_name='semestre_fk', new_name='semestre'),
        migrations.RenameField(model_name='evento', old_name='grupo_fk',    new_name='grupo'),
    ]
