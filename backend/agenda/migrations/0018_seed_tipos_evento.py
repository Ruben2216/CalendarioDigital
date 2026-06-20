from django.db import migrations, models
import django.db.models.deletion


TIPOS_GLOBALES = [
    {'nombre': 'INICIO DE CURSO',                                                                                        'color_hex': '#22C55E'},
    {'nombre': 'FIN DE CURSO',                                                                                           'color_hex': '#1E3A5F'},
    {'nombre': 'DÍA INHÁBIL',                                                                                           'color_hex': '#EF4444'},
    {'nombre': 'RECESO INTERSEMESTRAL',                                                                                  'color_hex': '#06B6D4'},
    {'nombre': 'VACACIONES',                                                                                             'color_hex': '#A855F7'},
    {'nombre': 'CIERRE DE PRIMERA EVALUACIÓN SUMATIVA',                                                                  'color_hex': '#3B82F6'},
    {'nombre': 'CIERRE DE SEGUNDA EVALUACIÓN SUMATIVA',                                                                  'color_hex': '#3B82F6'},
    {'nombre': 'CIERRE DE TERCERA EVALUACIÓN SUMATIVA',                                                                  'color_hex': '#3B82F6'},
    {'nombre': 'ENTREGA DE CALIFICACIONES',                                                                              'color_hex': '#EAB308'},
    {'nombre': 'PRIMERA EVALUACIÓN DE RECUPERACIÓN',                                                                     'color_hex': '#F97316'},
    {'nombre': 'SEGUNDA EVALUACIÓN DE RECUPERACIÓN',                                                                     'color_hex': '#F97316'},
    {'nombre': 'CURSO PROPEDÉUTICO ALUMNOS 1.er SEMESTRE',                                                               'color_hex': '#10B981'},
    {'nombre': 'REUNIÓN DE TRABAJO COLEGIADO',                                                                           'color_hex': '#14B8A6'},
    {'nombre': 'SESIÓN DEL PLAN DE MEJORA CONTINUA',                                                                     'color_hex': '#14B8A6'},
    {'nombre': 'SEMANA DE PLANEACIÓN DEL CICLO ESCOLAR',                                                                 'color_hex': '#1E3A5F'},
    {'nombre': 'SEMANA DE EVALUACIÓN DEL CICLO ESCOLAR',                                                                 'color_hex': '#1E3A5F'},
    {'nombre': 'ENCUENTRO ESTATAL ACADÉMICO, CULTURAL Y DEPORTIVO',                                                      'color_hex': '#EC4899'},
    {'nombre': 'JORNADA ACADÉMICA',                                                                                      'color_hex': '#EC4899'},
    {'nombre': 'JORNADA DE FORMACIÓN Y REFLEXIÓN SOBRE LA GRAVEDAD DEL ABUSO SEXUAL Y EL MALTRATO EN LAS ADOLESCENCIAS', 'color_hex': '#7C3AED'},
    {'nombre': 'JORNADA "TE EXTRAÑAMOS EN EL SALÓN"',                                                                   'color_hex': '#22C55E'},
]


def limpiar_e_insertar(apps, schema_editor):
    TipoEvento = apps.get_model('agenda', 'TipoEvento')
    TipoEvento.objects.all().delete()
    for datos in TIPOS_GLOBALES:
        TipoEvento.objects.create(plantel=None, **datos)


def revertir(apps, schema_editor):
    TipoEvento = apps.get_model('agenda', 'TipoEvento')
    nombres = [t['nombre'] for t in TIPOS_GLOBALES]
    TipoEvento.objects.filter(nombre__in=nombres, plantel__isnull=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0017_remove_tipoevento_clave'),
    ]

    operations = [
        # 1. Vaciar datos viejos antes de tocar el esquema
        #    Primero los eventos (FK PROTECT) y luego los tipos
        migrations.RunPython(
            lambda apps, se: (
                apps.get_model('agenda', 'Evento').objects.all().delete(),
                apps.get_model('agenda', 'TipoEvento').objects.all().delete(),
            ),
            migrations.RunPython.noop,
        ),

        # 2. Quitar campos obsoletos
        migrations.RemoveField(model_name='tipoevento', name='color'),
        migrations.RemoveField(model_name='tipoevento', name='orden'),

        # 3. Ampliar nombre y añadir nuevos campos
        migrations.AlterField(
            model_name='tipoevento',
            name='nombre',
            field=models.CharField(max_length=120),
        ),
        migrations.AddField(
            model_name='tipoevento',
            name='color_hex',
            field=models.CharField(default='#64748B', max_length=7),
        ),
        migrations.AddField(
            model_name='tipoevento',
            name='plantel',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='tipos_evento',
                to='agenda.plantel',
            ),
        ),

        # 4. Insertar los 20 tipos globales del superusuario
        migrations.RunPython(limpiar_e_insertar, revertir),
    ]
