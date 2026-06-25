import django.db.models.deletion
from django.db import connection, migrations, models


# ── helpers de inspección ─────────────────────────────────────────────────────

def _tabla_existe(nombre):
    with connection.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM sys.objects WHERE object_id = OBJECT_ID(%s) AND type = 'U'",
            [nombre],
        )
        return cur.fetchone()[0] > 0


def _columna_existe(tabla, columna):
    with connection.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM sys.columns "
            "WHERE object_id = OBJECT_ID(%s) AND name = %s",
            [tabla, columna],
        )
        return cur.fetchone()[0] > 0


# ── paso 1: catálogos ─────────────────────────────────────────────────────────

def crear_semestre(apps, schema_editor):
    if not _tabla_existe('Semestre'):
        schema_editor.execute(
            "CREATE TABLE [Semestre] ("
            "  [id_semestre] int NOT NULL,"
            "  CONSTRAINT [PK_Semestre] PRIMARY KEY ([id_semestre])"
            ")"
        )


def crear_letra(apps, schema_editor):
    if not _tabla_existe('Letra'):
        schema_editor.execute(
            "CREATE TABLE [Letra] ("
            "  [id_letra] nvarchar(1) NOT NULL,"
            "  CONSTRAINT [PK_Letra] PRIMARY KEY ([id_letra])"
            ")"
        )


def seed_catalogos(apps, schema_editor):
    Semestre = apps.get_model('agenda', 'Semestre')
    Letra = apps.get_model('agenda', 'Letra')
    for i in range(1, 7):
        Semestre.objects.get_or_create(id_semestre=i)
    for l in 'ABCDEFGHIJ':
        Letra.objects.get_or_create(id_letra=l)


# ── paso 2: reconstruir Grupo ─────────────────────────────────────────────────

def reconstruir_grupo(apps, schema_editor):
    # Grupo está vacío; si la estructura ya es la nueva no hacer nada.
    nueva_estructura = (
        _tabla_existe('Grupo')
        and _columna_existe('Grupo', 'semestre_id')
        and _columna_existe('Grupo', 'letra_id')
        and not _columna_existe('Grupo', 'turno_id')
    )
    if nueva_estructura:
        return

    # Eliminar tabla vieja (vacía) si existe
    if _tabla_existe('Grupo'):
        schema_editor.execute("DROP TABLE [Grupo]")

    schema_editor.execute(
        "CREATE TABLE [Grupo] ("
        "  [id_grupo] bigint IDENTITY(1,1) NOT NULL,"
        "  [semestre_id] int NOT NULL,"
        "  [letra_id] nvarchar(1) NOT NULL,"
        "  CONSTRAINT [PK_Grupo] PRIMARY KEY ([id_grupo]),"
        "  CONSTRAINT [UQ_Grupo_semestre_letra] UNIQUE ([semestre_id],[letra_id]),"
        "  CONSTRAINT [FK_Grupo_semestre] FOREIGN KEY ([semestre_id]) REFERENCES [Semestre]([id_semestre]),"
        "  CONSTRAINT [FK_Grupo_letra]    FOREIGN KEY ([letra_id])    REFERENCES [Letra]([id_letra])"
        ")"
    )


def seed_grupos(apps, schema_editor):
    Semestre = apps.get_model('agenda', 'Semestre')
    Letra = apps.get_model('agenda', 'Letra')
    Grupo = apps.get_model('agenda', 'Grupo')
    for s in Semestre.objects.all():
        for l in Letra.objects.all():
            Grupo.objects.get_or_create(semestre=s, letra=l)


# ── paso 3: migrar Evento ─────────────────────────────────────────────────────

def migrar_evento_semestre(apps, schema_editor):
    """Convierte Evento.semestre de int a FK → Semestre."""
    if _columna_existe('Evento', 'semestre_id'):
        return  # ya migrado

    # Añadir columna FK nullable
    schema_editor.execute(
        "ALTER TABLE [Evento] ADD [semestre_id] int NULL "
        "CONSTRAINT [FK_Evento_semestre] FOREIGN KEY REFERENCES [Semestre]([id_semestre])"
    )
    # Copiar valores existentes de la columna vieja
    if _columna_existe('Evento', 'semestre'):
        schema_editor.execute(
            "UPDATE [Evento] SET [semestre_id] = [semestre] "
            "WHERE [semestre] IS NOT NULL AND [semestre] BETWEEN 1 AND 6"
        )
        schema_editor.execute("ALTER TABLE [Evento] DROP COLUMN [semestre]")


def migrar_evento_grupo(apps, schema_editor):
    """Convierte Evento.grupo de varchar a FK → Grupo."""
    if _columna_existe('Evento', 'grupo_id'):
        return  # ya migrado

    # Añadir columna FK nullable
    schema_editor.execute(
        "ALTER TABLE [Evento] ADD [grupo_id] bigint NULL "
        "CONSTRAINT [FK_Evento_grupo] FOREIGN KEY REFERENCES [Grupo]([id_grupo])"
    )
    # Poblar desde las columnas viejas (semestre_id ya existe en este punto)
    if _columna_existe('Evento', 'grupo'):
        schema_editor.execute(
            "UPDATE e SET e.[grupo_id] = g.[id_grupo] "
            "FROM [Evento] e "
            "JOIN [Grupo] g ON g.[semestre_id] = e.[semestre_id] "
            "                AND g.[letra_id]   = UPPER(LTRIM(RTRIM(e.[grupo]))) "
            "WHERE e.[grupo] IS NOT NULL AND e.[semestre_id] IS NOT NULL"
        )
        schema_editor.execute("ALTER TABLE [Evento] DROP COLUMN [grupo]")


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0034_plantel_uniqueidentifier_field'),
    ]

    operations = [
        # ── 1. Tablas catálogo ────────────────────────────────────────────────
        migrations.SeparateDatabaseAndState(
            database_operations=[migrations.RunPython(crear_semestre, migrations.RunPython.noop)],
            state_operations=[
                migrations.CreateModel(
                    name='Semestre',
                    fields=[('id_semestre', models.IntegerField(primary_key=True, serialize=False))],
                    options={'db_table': 'Semestre'},
                )
            ],
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[migrations.RunPython(crear_letra, migrations.RunPython.noop)],
            state_operations=[
                migrations.CreateModel(
                    name='Letra',
                    fields=[('id_letra', models.CharField(max_length=1, primary_key=True, serialize=False))],
                    options={'db_table': 'Letra'},
                )
            ],
        ),
        migrations.RunPython(seed_catalogos, migrations.RunPython.noop),

        # ── 2. Reconstruir Grupo ──────────────────────────────────────────────
        migrations.SeparateDatabaseAndState(
            database_operations=[migrations.RunPython(reconstruir_grupo, migrations.RunPython.noop)],
            state_operations=[
                migrations.DeleteModel(name='Grupo'),
                migrations.CreateModel(
                    name='Grupo',
                    fields=[
                        ('id_grupo', models.BigAutoField(primary_key=True, serialize=False)),
                        ('semestre', models.ForeignKey(
                            on_delete=django.db.models.deletion.CASCADE,
                            related_name='grupos', to='agenda.semestre',
                        )),
                        ('letra', models.ForeignKey(
                            on_delete=django.db.models.deletion.CASCADE,
                            related_name='grupos', to='agenda.letra',
                        )),
                    ],
                    options={'db_table': 'Grupo'},
                ),
                migrations.AlterUniqueTogether(name='grupo', unique_together={('semestre', 'letra')}),
            ],
        ),
        migrations.RunPython(seed_grupos, migrations.RunPython.noop),

        # ── 3. Evento: semestre int → FK, grupo varchar → FK ─────────────────
        migrations.SeparateDatabaseAndState(
            database_operations=[migrations.RunPython(migrar_evento_semestre, migrations.RunPython.noop)],
            state_operations=[
                migrations.RemoveField(model_name='evento', name='semestre'),
                migrations.AddField(
                    model_name='evento',
                    name='semestre',
                    field=models.ForeignKey(
                        blank=True, null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='eventos', to='agenda.semestre',
                    ),
                ),
            ],
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[migrations.RunPython(migrar_evento_grupo, migrations.RunPython.noop)],
            state_operations=[
                migrations.RemoveField(model_name='evento', name='grupo'),
                migrations.AddField(
                    model_name='evento',
                    name='grupo',
                    field=models.ForeignKey(
                        blank=True, null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='eventos', to='agenda.grupo',
                    ),
                ),
            ],
        ),
    ]
