import json
import re
import uuid

from django.contrib.auth.hashers import check_password, make_password
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import OuterRef, Q

from .fields import UniqueIdentifierField


class Rol(models.Model):
    id_rol = models.BigAutoField(primary_key=True)
    nombre_rol = models.CharField(max_length=50, unique=True)

    class Meta:
        db_table = 'Rol'

    def __str__(self):
        return self.nombre_rol


class Agrupacion(models.Model):
    id_agrupacion = UniqueIdentifierField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre = models.CharField(max_length=200, unique=True)
    parent = models.ForeignKey(
        'self', on_delete=models.CASCADE, null=True, blank=True,
        related_name='subagrupaciones', db_column='parent_id'
    )

    class Meta:
        db_table = 'Agrupacion'

    def __str__(self):
        return self.nombre


class Plantel(models.Model):
    id_plantel = UniqueIdentifierField(primary_key=True, default=uuid.uuid4, editable=False)
    clave = models.CharField(max_length=10, unique=True)
    nombre = models.CharField(max_length=250)
    agrupacion = models.ForeignKey(
        'Agrupacion',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='agrupacion_id',
        related_name='planteles'
    )

    class Meta:
        db_table = 'Plantel'

    def __str__(self):
        return self.nombre

    @staticmethod
    def normalizar(nombre):
        """Reduce un nombre de plantel a solo letras/números en minúsculas para
        comparar cadenas que vienen de distintas fuentes (API institucional vs BD).
        """
        return re.sub(r'[^a-z0-9]', '', (nombre or '').lower())

    @classmethod
    def equivalentes(cls, nombre):
        """IDs de planteles con nombre normalizado que coincide o contiene al buscado."""
        objetivo = cls.normalizar(nombre)
        if not objetivo:
            return []
        ids = []
        for p in cls.objects.all():
            n = cls.normalizar(p.nombre)
            if n and (n == objetivo or objetivo in n or n in objetivo):
                ids.append(p.id_plantel)
        return ids


class Turno(models.Model):
    id_turno = models.BigAutoField(primary_key=True)
    nombre_turno = models.CharField(max_length=30, unique=True)

    class Meta:
        db_table = 'Turno'

    def __str__(self):
        return self.nombre_turno


class Semestre(models.Model):
    id_semestre = models.IntegerField(primary_key=True)

    class Meta:
        db_table = 'Semestre'

    def __str__(self):
        return str(self.id_semestre)


class Letra(models.Model):
    id_letra = models.CharField(max_length=1, primary_key=True)

    class Meta:
        db_table = 'Letra'

    def __str__(self):
        return self.id_letra


class Grupo(models.Model):
    id_grupo = models.BigAutoField(primary_key=True)
    semestre = models.ForeignKey(
        Semestre, on_delete=models.CASCADE, related_name='grupos'
    )
    letra = models.ForeignKey(
        Letra, on_delete=models.CASCADE, related_name='grupos'
    )

    class Meta:
        db_table = 'Grupo'
        unique_together = ('semestre', 'letra')

    def __str__(self):
        return f'{self.semestre_id}-{self.letra_id}'


class Usuario(models.Model):
    # Roles con gestión global del calendario: ven y editan eventos/anuncios de
    # toda la institución. El colaborador comparte alcance con el superusuario
    # salvo mensajería y administración de usuarios (exclusivas del superusuario).
    ROLES_GESTION_GLOBAL = ('superusuario', 'colaborador', 'director_departamento', 'subdirector_departamento')

    id_usuario = models.BigAutoField(primary_key=True)
    rol = models.ForeignKey(
        Rol, on_delete=models.PROTECT, related_name='usuarios'
    )
    # Se removieron plantel y turno directos. 
    # La relacion ahora es a través de UsuarioPlantel.
    correo = models.CharField(max_length=100, unique=True)
    nombre = models.CharField(max_length=150, null=True, blank=True)
    google_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    matricula = models.CharField(max_length=20, null=True, blank=True, unique=True)
    password_mock = models.CharField(max_length=128, null=True, blank=True)
    id_api = models.CharField(max_length=100, null=True, blank=True)
    agrupacion = models.ForeignKey(
        'Agrupacion',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='agrupacion_id',
        related_name='usuarios'
    )
    activo = models.BooleanField(default=True)
    ultima_sesion = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'Usuario'

    def __str__(self):
        return f'{self.correo} ({self.rol.nombre_rol})'

    def es_gestor_global(self):
        return self.rol.nombre_rol in self.ROLES_GESTION_GLOBAL

    def asignar_password_mock(self, password):
        self.password_mock = make_password(password)
        Usuario.objects.filter(pk=self.pk).update(password_mock=self.password_mock)

    def verificar_password_mock(self, password):
        # password_mock guarda un hash PBKDF2; los valores en texto plano
        # heredados no validan y deben reasignarse con asignar_password_mock.
        return bool(self.password_mock) and check_password(password, self.password_mock)

    def _asignaciones_plantel_turno(self):
        # Cacheado en la instancia: varias vistas llaman ids_planteles()/ids_turnos()
        # más de una vez por request y values_list() no reutiliza el prefetch_related.
        if not hasattr(self, '_cache_asignaciones'):
            self._cache_asignaciones = list(
                self.planteles_asignados.values_list('plantel_id', 'turno_id')
            )
        return self._cache_asignaciones

    def ids_planteles(self):
        return [plantel_id for plantel_id, _ in self._asignaciones_plantel_turno()]

    def ids_turnos(self):
        return [turno_id for _, turno_id in self._asignaciones_plantel_turno()]

    def ids_planteles_agrupacion(self):
        if not self.agrupacion_id:
            return []
        return list(self.agrupacion.planteles.values_list('id_plantel', flat=True))

    def ids_planteles_agrupacion_herencia(self):
        """Planteles de la agrupación del usuario + los de todas sus
        subagrupaciones (para herencia jerárquica Director → Subdirecciones)."""
        if not self.agrupacion_id:
            return []
        q = Q(agrupacion=self.agrupacion) | Q(agrupacion__parent=self.agrupacion)
        return list(Plantel.objects.filter(q).values_list('id_plantel', flat=True))

    def alcance_plantel(self, campo='plantel', plantel_filtro=None):
        """Q para filtrar `campo` según el rol y agrupación:
        - Gestor global (superusuario/colaborador/director): solo eventos
          generales por defecto, + plantel_filtro si se proporciona.
        - Subdirector de departamento (con agrupación): eventos del alcance
          de su agrupación + generales.
        - Otros (admin sin agrupación, docente, alumno): eventos de sus planteles
          asignados + generales."""
        general = Q(**{f'{campo}__isnull': True})
        if self.es_gestor_global():
            if plantel_filtro:
                return general | Q(**{f'{campo}__nombre': plantel_filtro})
            return general
        base_ids = self.ids_planteles_agrupacion() or self.ids_planteles()
        return general | Q(**{f'{campo}_id__in': base_ids})

    def a_sesion_dict(self, **extra):
        agrupacion_data = None
        if self.agrupacion_id:
            ids = self.ids_planteles_agrupacion_herencia() if self.rol.nombre_rol == 'director_departamento' else self.ids_planteles_agrupacion()
            agrupacion_data = {
                'id': str(self.agrupacion.id_agrupacion),
                'nombre': self.agrupacion.nombre,
                'planteles': list(Plantel.objects.filter(id_plantel__in=ids).values_list('nombre', flat=True)) if ids else [],
            }
        return {
            'id_usuario': self.id_usuario,
            'rol': self.rol.nombre_rol,
            'correo': self.correo or '',
            'agrupacion': agrupacion_data,
            'planteles': [
                {
                    'plantel': {'id': up.plantel.id_plantel, 'nombre': up.plantel.nombre},
                    'turno': {'id': up.turno.id_turno, 'nombre': up.turno.nombre_turno},
                }
                for up in self.planteles_asignados.all()
            ],
            **extra,
        }


class GoogleOauthCredential(models.Model):
    usuario = models.OneToOneField(
        Usuario, on_delete=models.CASCADE, related_name='google_credentials'
    )
    email_google = models.EmailField(null=True, blank=True)
    access_token = models.TextField()
    refresh_token = models.TextField(null=True, blank=True)
    scopes = models.TextField()
    expiry = models.DateTimeField()
    semestre = models.ForeignKey(
        'Semestre', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='credenciales_google'
    )
    grupo = models.ForeignKey(
        'Grupo', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='credenciales_google'
    )

    class Meta:
        db_table = 'GoogleOauthCredential'

    def __str__(self):
        return f'Google Calendar - {self.usuario.correo} ({self.email_google or "sin email"})'


class UsuarioPlantel(models.Model):
    id_usuario_plantel = models.BigAutoField(primary_key=True)
    usuario = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='planteles_asignados'
    )
    plantel = models.ForeignKey(
        Plantel, on_delete=models.CASCADE, related_name='usuarios_asignados'
    )
    turno = models.ForeignKey(
        Turno, on_delete=models.CASCADE, related_name='usuarios_asignados'
    )

    class Meta:
        db_table = 'UsuarioPlantel'
        unique_together = ('usuario', 'plantel', 'turno')

    def __str__(self):
        return f'{self.usuario.correo} - {self.plantel.nombre} - {self.turno.nombre_turno}'

    @classmethod
    def match(cls, plantel_id, turno_nombre=None):
        """Queryset con OuterRef('pk') listo para envolver en Exists(...):
        usuarios con una asignación a `plantel_id` (y, si se indica, en ese
        turno o en turno 'Mixto')."""
        qs = cls.objects.filter(usuario=OuterRef('pk'), plantel_id=plantel_id)
        if turno_nombre:
            qs = qs.filter(Q(turno__nombre_turno=turno_nombre) | Q(turno__nombre_turno='Mixto'))
        return qs


class Calendario(models.Model):
    CLAVE_ESCOLARIZADO = 'escolarizado'
    CLAVE_SEA = 'sea'

    id_calendario = models.BigAutoField(primary_key=True)
    nombre = models.CharField(max_length=120)
    clave = models.CharField(max_length=30, unique=True)
    ciclo = models.CharField(max_length=20)
    es_publico = models.BooleanField(default=True)
    activo = models.BooleanField(default=True)
    orden = models.IntegerField(default=0)

    class Meta:
        db_table = 'Calendario'
        ordering = ['orden', 'id_calendario']

    def __str__(self):
        return f'{self.nombre} ({self.ciclo})'


class TipoEvento(models.Model):
    id_tipo_evento = models.BigAutoField(primary_key=True)
    nombre = models.CharField(max_length=120)
    color_hex = models.CharField(max_length=7, default='#64748B')
    plantel = models.ForeignKey(
        'Plantel', on_delete=models.CASCADE, null=True, blank=True, related_name='tipos_evento'
    )
    agrupacion = models.ForeignKey(
        'Agrupacion', on_delete=models.CASCADE, null=True, blank=True, related_name='tipos_evento'
    )

    class Meta:
        db_table = 'TipoEvento'
        ordering = ['plantel', 'agrupacion', 'id_tipo_evento']

    def __str__(self):
        return self.nombre


class Evento(models.Model):
    id_evento = models.BigAutoField(primary_key=True)
    calendario = models.ForeignKey(
        Calendario, on_delete=models.CASCADE, related_name='eventos'
    )
    tipo_evento = models.ForeignKey(
        TipoEvento, on_delete=models.PROTECT, related_name='eventos'
    )
    titulo = models.CharField(max_length=200)
    area = models.CharField(max_length=80, blank=True, default='')
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField(null=True, blank=True)
    hora_inicio = models.TimeField(null=True, blank=True)
    hora_fin = models.TimeField(null=True, blank=True)
    lugar = models.CharField(max_length=150, blank=True, default='')
    plantel = models.ForeignKey(
        Plantel, on_delete=models.CASCADE, null=True, blank=True, related_name='eventos'
    )
    agrupacion = models.ForeignKey(
        Agrupacion, on_delete=models.CASCADE, null=True, blank=True, related_name='eventos'
    )
    turno = models.ForeignKey(
        Turno, on_delete=models.CASCADE, null=True, blank=True, related_name='eventos'
    )
    semestre = models.ForeignKey(
        'Semestre', on_delete=models.SET_NULL, null=True, blank=True, related_name='eventos'
    )
    grupo = models.ForeignKey(
        'Grupo', on_delete=models.SET_NULL, null=True, blank=True, related_name='eventos'
    )
    creado_por = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='eventos_creados'
    )
    publico = models.BooleanField(
        null=True, blank=True, default=None
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'Evento'
        ordering = ['fecha_inicio', 'hora_inicio']

    def __str__(self):
        return f'{self.titulo} ({self.fecha_inicio})'

    @property
    def es_general(self) -> bool:
        """Evento institucional: sin plantel ni turno, visible para todos."""
        return self.plantel_id is None and self.turno_id is None

    def puede_editar(self, usuario) -> bool:
        if usuario is None:
            return False
        if usuario.es_gestor_global():
            if usuario.agrupacion_id:
                if self.agrupacion_id == usuario.agrupacion_id:
                    return True
                return self.plantel_id in usuario.ids_planteles_agrupacion_herencia()
            return True
        if usuario.rol.nombre_rol in ('admin', 'subdirector_departamento'):
            if self.agrupacion_id and self.agrupacion_id == usuario.agrupacion_id:
                return True
            ids = usuario.ids_planteles_agrupacion() or usuario.ids_planteles()
            return self.plantel_id in ids
        return False


class EventoGoogleSync(models.Model):
    """Mapea cada evento a cada usuario que lo tiene sincronizado en su Google Calendar."""
    evento = models.ForeignKey(
        Evento, on_delete=models.CASCADE, related_name='google_syncs'
    )
    usuario = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='google_event_syncs'
    )
    google_event_id = models.CharField(max_length=255)

    class Meta:
        db_table = 'EventoGoogleSync'
        unique_together = ('evento', 'usuario')

    def __str__(self):
        return f'{self.usuario.correo} → evento {self.evento_id}'


class Anuncio(models.Model):
    AUDIENCIA_TODOS = 'todos'
    AUDIENCIAS = [
        (AUDIENCIA_TODOS, 'Todos'),
        ('colaborador', 'Colaboradores'),
        ('admin', 'Administrativo'),
        ('docente', 'Docentes'),
        ('alumno', 'Alumnos'),
    ]

    id_anuncio = models.BigAutoField(primary_key=True)
    titulo = models.CharField(max_length=200)
    descripcion = models.TextField()
    color = models.CharField(max_length=20, default='azul')
    audiencia = models.CharField(max_length=20, choices=AUDIENCIAS, default=AUDIENCIA_TODOS)
    plantel = models.ForeignKey(
        Plantel, on_delete=models.CASCADE, null=True, blank=True, related_name='anuncios'
    )
    turno = models.ForeignKey(
        'Turno', on_delete=models.CASCADE, null=True, blank=True, related_name='anuncios'
    )
    creado_por = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='anuncios_creados'
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'Anuncio'
        ordering = ['-fecha_creacion']

    def __str__(self):
        return self.titulo

    @property
    def es_general(self) -> bool:
        return self.plantel_id is None

    def puede_editar(self, usuario) -> bool:
        if usuario is None:
            return False
        if usuario.es_gestor_global():
            if usuario.agrupacion_id:
                ids = usuario.ids_planteles_agrupacion_herencia() if usuario.rol.nombre_rol == 'director_departamento' else usuario.ids_planteles_agrupacion()
                if not ids or self.plantel_id is None:
                    return False
                return self.plantel_id in ids
            return True
        if usuario.rol.nombre_rol == 'admin':
            return self.creado_por_id == usuario.id_usuario
        return False


class Conversacion(models.Model):
    id_conversacion = models.BigAutoField(primary_key=True)
    participante_a = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='conversaciones_como_a'
    )
    participante_b = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='conversaciones_como_b'
    )
    plantel = models.ForeignKey(
        Plantel, on_delete=models.CASCADE, related_name='conversaciones'
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    activa = models.BooleanField(default=True)

    class Meta:
        db_table = 'Conversacion'
        unique_together = ('participante_a', 'participante_b')
        constraints = [
            models.CheckConstraint(
                condition=models.Q(participante_a_id__lt=models.F('participante_b_id')),
                name='chk_conversacion_orden_participantes',
            )
        ]

    @staticmethod
    def par_ordenado(id_a: int, id_b: int) -> tuple[int, int]:
        return (min(id_a, id_b), max(id_a, id_b))

    def es_participante(self, id_usuario: int) -> bool:
        return id_usuario in (self.participante_a_id, self.participante_b_id)


class Mensaje(models.Model):
    id_mensaje = models.BigAutoField(primary_key=True)
    conversacion = models.ForeignKey(
        Conversacion, on_delete=models.CASCADE, related_name='mensajes'
    )
    remitente = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='mensajes_enviados'
    )
    contenido_cifrado = models.TextField()
    iv = models.CharField(max_length=24)
    metadatos_cifrados = models.TextField(null=True, blank=True)
    iv_metadatos = models.CharField(max_length=24, null=True, blank=True)
    fecha_envio = models.DateTimeField(auto_now_add=True)
    eliminado = models.BooleanField(default=False)

    class Meta:
        db_table = 'Mensaje'
        ordering = ['fecha_envio']

    @classmethod
    def crear(cls, conversacion, remitente, texto: str, metadatos: dict = None):
        from .services.cifrado import cifrar
        contenido_b64, iv_b64 = cifrar(texto)
        meta_b64, iv_meta_b64 = (None, None)
        if metadatos:
            meta_b64, iv_meta_b64 = cifrar(json.dumps(metadatos, ensure_ascii=False))
        return cls.objects.create(
            conversacion=conversacion,
            remitente=remitente,
            contenido_cifrado=contenido_b64,
            iv=iv_b64,
            metadatos_cifrados=meta_b64,
            iv_metadatos=iv_meta_b64,
        )

    def texto(self) -> str:
        from .services.cifrado import descifrar
        return descifrar(self.contenido_cifrado, self.iv)

    def metadatos(self) -> dict | None:
        from .services.cifrado import descifrar
        if not self.metadatos_cifrados:
            return None
        return json.loads(descifrar(self.metadatos_cifrados, self.iv_metadatos))


class LecturaMensaje(models.Model):
    id_lectura_mensaje = models.BigAutoField(primary_key=True)
    conversacion = models.ForeignKey(
        Conversacion, on_delete=models.CASCADE, related_name='lecturas'
    )
    usuario = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='lecturas'
    )
    ultimo_leido = models.ForeignKey(
        Mensaje, on_delete=models.SET_NULL, null=True, related_name='+'
    )

    def clean(self):
        if self.ultimo_leido_id is not None:
            if self.ultimo_leido.conversacion_id != self.conversacion_id:
                raise ValidationError(
                    'El mensaje último leído no pertenece a esta conversación.'
                )

    class Meta:
        db_table = 'LecturaMensaje'
        unique_together = ('conversacion', 'usuario')


class Notificacion(models.Model):
    CATEGORIA_ANUNCIO = 'anuncio'
    CATEGORIA_EVENTO = 'evento'
    CATEGORIAS = [
        (CATEGORIA_ANUNCIO, 'Anuncio'),
        (CATEGORIA_EVENTO, 'Evento'),
    ]

    id_notificacion = models.BigAutoField(primary_key=True)
    categoria      = models.CharField(max_length=20, choices=CATEGORIAS, default=CATEGORIA_ANUNCIO)
    titulo         = models.CharField(max_length=200)
    mensaje        = models.TextField(blank=True, default='')
    audiencia      = models.CharField(max_length=20, default='todos')
    plantel        = models.ForeignKey(
        Plantel, on_delete=models.CASCADE, null=True, blank=True, related_name='notificaciones'
    )
    turno          = models.ForeignKey(
        'Turno', on_delete=models.CASCADE, null=True, blank=True, related_name='notificaciones'
    )

    anuncio = models.ForeignKey(
        Anuncio, on_delete=models.SET_NULL, null=True, blank=True, related_name='notificaciones'
    )
    evento = models.ForeignKey(
        Evento, on_delete=models.SET_NULL, null=True, blank=True, related_name='notificaciones'
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'Notificacion'
        ordering = ['-fecha_creacion']

    def __str__(self):
        return f'[{self.categoria}] {self.titulo}'


class SolicitudAdmin(models.Model):
    """Solicitud de acceso de un docente/administrativo. Según su tipo:
    - admin: su cuenta pasa a rol administrador (la resuelve el superusuario).
    - visualizacion: se le asigna un plantel adicional solo para visualizarlo
      (la resuelven los administradores del plantel, límite de 2 planteles).
    - turno: se le cambia el turno en uno de sus planteles asignados
      (la resuelven los administradores del plantel).
    Ver ResolverSolicitudAdminView."""

    ESTADO_PENDIENTE = 'pendiente'
    ESTADO_ACEPTADA = 'aceptada'
    ESTADO_RECHAZADA = 'rechazada'
    ESTADO_REVOCADA = 'revocada'
    ESTADOS = [
        (ESTADO_PENDIENTE, 'Pendiente'),
        (ESTADO_ACEPTADA, 'Aceptada'),
        (ESTADO_RECHAZADA, 'Rechazada'),
        (ESTADO_REVOCADA, 'Revocada'),
    ]

    TIPO_ADMIN = 'admin'
    TIPO_VISUALIZACION = 'visualizacion'
    TIPO_TURNO = 'turno'
    TIPOS = [
        (TIPO_ADMIN, 'Administrador'),
        (TIPO_VISUALIZACION, 'Visualizar plantel'),
        (TIPO_TURNO, 'Cambio de turno'),
    ]

    LIMITE_PLANTELES = 2

    id_solicitud_admin = models.BigAutoField(primary_key=True)
    tipo = models.CharField(max_length=20, choices=TIPOS, default=TIPO_ADMIN)
    usuario = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='solicitudes_admin'
    )
    plantel = models.ForeignKey(
        Plantel, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='solicitudes_admin'
    )
    turno = models.ForeignKey(
        Turno, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='solicitudes_admin'
    )
    motivo = models.TextField(blank=True, default='')
    estado = models.CharField(max_length=20, choices=ESTADOS, default=ESTADO_PENDIENTE)
    fecha_solicitud = models.DateTimeField(auto_now_add=True)
    resuelta_por = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='solicitudes_resueltas'
    )
    fecha_resolucion = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'SolicitudAdmin'
        ordering = ['-fecha_solicitud']

    def __str__(self):
        return f'{self.usuario.correo} ({self.estado})'


class DispositivoFCM(models.Model):
    id_dispositivo = models.BigAutoField(primary_key=True)
    usuario = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, null=True, blank=True,
        related_name='dispositivos'
    )
    token_fcm = models.CharField(max_length=255, unique=True)
    temas = models.JSONField(default=list, blank=True)
    activo = models.BooleanField(default=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'DispositivoFCM'
        ordering = ['-fecha_actualizacion']

    def __str__(self):
        return f'{self.token_fcm[:12]}…'


class AuditoriaLog(models.Model):
    id_log = models.BigAutoField(primary_key=True)
    fecha_hora = models.DateTimeField(auto_now_add=True)
    usuario_id = models.BigIntegerField(null=True, blank=True)
    usuario_nombre = models.CharField(max_length=150, null=True, blank=True)
    usuario_correo = models.CharField(max_length=100, null=True, blank=True)
    usuario_rol = models.CharField(max_length=50, null=True, blank=True)
    accion = models.CharField(max_length=20)
    entidad_tipo = models.CharField(max_length=50)
    entidad_id = models.CharField(max_length=100, null=True, blank=True)
    datos_previos = models.JSONField(null=True, blank=True)
    datos_nuevos = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = 'AuditoriaLog'
        indexes = [
            models.Index(fields=['fecha_hora']),
            models.Index(fields=['usuario_id']),
            models.Index(fields=['entidad_tipo']),
        ]
