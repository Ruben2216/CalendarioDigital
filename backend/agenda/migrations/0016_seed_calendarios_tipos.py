from django.db import migrations


CALENDARIOS = [
    {'clave': 'escolarizado', 'nombre': 'Calendario Escolar', 'ciclo': '2025-2026', 'es_publico': True, 'orden': 1},
    {'clave': 'sea', 'nombre': 'SEA · Sistema de Enseñanza Abierta', 'ciclo': '2026-2027', 'es_publico': True, 'orden': 2},
]

TIPOS_EVENTO = [
    {'clave': 'inicio-fin-curso', 'nombre': 'Inicio / Fin de curso', 'color': 'marino', 'orden': 1},
    {'clave': 'dia-inhabil', 'nombre': 'Día inhábil / Suspensión', 'color': 'rojo', 'orden': 2},
    {'clave': 'vacaciones', 'nombre': 'Vacaciones', 'color': 'morado', 'orden': 3},
    {'clave': 'receso-intersemestral', 'nombre': 'Receso intersemestral', 'color': 'cian', 'orden': 4},
    {'clave': 'evaluacion', 'nombre': 'Evaluación', 'color': 'azul', 'orden': 5},
    {'clave': 'recuperacion', 'nombre': 'Evaluación de recuperación', 'color': 'naranja', 'orden': 6},
    {'clave': 'entrega-calificaciones', 'nombre': 'Entrega de calificaciones', 'color': 'amarillo', 'orden': 7},
    {'clave': 'trabajo-colegiado', 'nombre': 'Reunión / Trabajo colegiado', 'color': 'teal', 'orden': 8},
    {'clave': 'inscripciones', 'nombre': 'Inscripciones / Trámites', 'color': 'verde', 'orden': 9},
    {'clave': 'academico-cultural-deportivo', 'nombre': 'Académico, cultural y deportivo', 'color': 'rosa', 'orden': 10},
]


def sembrar(apps, schema_editor):
    Calendario = apps.get_model('agenda', 'Calendario')
    TipoEvento = apps.get_model('agenda', 'TipoEvento')

    for datos in CALENDARIOS:
        Calendario.objects.update_or_create(clave=datos['clave'], defaults=datos)

    for datos in TIPOS_EVENTO:
        TipoEvento.objects.update_or_create(clave=datos['clave'], defaults=datos)


def revertir(apps, schema_editor):
    Calendario = apps.get_model('agenda', 'Calendario')
    TipoEvento = apps.get_model('agenda', 'TipoEvento')
    Calendario.objects.filter(clave__in=[c['clave'] for c in CALENDARIOS]).delete()
    TipoEvento.objects.filter(clave__in=[t['clave'] for t in TIPOS_EVENTO]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0015_calendario_tipoevento_evento'),
    ]

    operations = [
        migrations.RunPython(sembrar, revertir),
    ]
