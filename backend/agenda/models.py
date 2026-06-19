import json

from django.db import models


class Rol(models.Model):
    id_rol = models.BigAutoField(primary_key=True)
    nombre_rol = models.CharField(max_length=50, unique=True)

    class Meta:
        db_table = 'Rol'

    def __str__(self):
        return self.nombre_rol


class Plantel(models.Model):
    id_plantel = models.BigAutoField(primary_key=True)
    nombre = models.CharField(max_length=100)

    class Meta:
        db_table = 'Plantel'

    def __str__(self):
        return self.nombre


class Turno(models.Model):
    id_turno = models.BigAutoField(primary_key=True)
    nombre_turno = models.CharField(max_length=30, unique=True)

    class Meta:
        db_table = 'Turno'

    def __str__(self):
        return self.nombre_turno


class Grupo(models.Model):
    id_grupo = models.BigAutoField(primary_key=True)
    turno = models.ForeignKey(
        Turno, on_delete=models.CASCADE, related_name='grupos'
    )
    letra = models.CharField(max_length=1)
    semestre = models.IntegerField()

    class Meta:
        db_table = 'Grupo'

    def __str__(self):
        return f'{self.semestre}-{self.letra} ({self.turno.nombre_turno})'


class Usuario(models.Model):
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
    activo = models.BooleanField(default=True)
    ultima_sesion = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'Usuario'

    def __str__(self):
        return f'{self.correo} ({self.rol.nombre_rol})'


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


class PermisoEspecial(models.Model):
    id_permiso_especial = models.BigAutoField(primary_key=True)
    usuario = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='permisos_especiales'
    )
    turno_objetivo = models.ForeignKey(
        Turno, on_delete=models.CASCADE, related_name='permisos_otorgados'
    )
    autorizado_por = models.ForeignKey(
        Usuario, on_delete=models.PROTECT, related_name='permisos_autorizados'
    )
    fecha_autorizacion = models.DateTimeField(auto_now_add=True)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'PermisoEspecial'


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
    nombre = models.CharField(max_length=80)
    color = models.CharField(max_length=20)

    class Meta:
        db_table = 'TipoEvento'
        ordering = ['id_tipo_evento']

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
    turno = models.ForeignKey(
        Turno, on_delete=models.CASCADE, null=True, blank=True, related_name='eventos'
    )
    semestre = models.IntegerField(null=True, blank=True)
    grupo = models.CharField(max_length=2, null=True, blank=True)
    creado_por = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='eventos_creados'
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
        """Superusuario edita todo; el resto solo lo que creó."""
        if usuario is None:
            return False
        rol = usuario.rol.nombre_rol
        if rol == 'superusuario':
            return True
        if rol == 'admin':
            return self.creado_por_id == usuario.id_usuario
        return False


class Anuncio(models.Model):
    AUDIENCIA_TODOS = 'todos'
    AUDIENCIAS = [
        (AUDIENCIA_TODOS, 'Todos'),
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
        rol = usuario.rol.nombre_rol
        if rol == 'superusuario':
            return True
        if rol == 'admin':
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

    class Meta:
        db_table = 'LecturaMensaje'
        unique_together = ('conversacion', 'usuario')


class Notificacion(models.Model):
    TIPOS = [
        ('evento_creado',      'Evento creado'),
        ('evento_actualizado', 'Evento actualizado'),
        ('evento_eliminado',   'Evento eliminado'),
        ('recordatorio',       'Recordatorio'),
    ]

    id_notificacion = models.BigAutoField(primary_key=True)
    usuario        = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='notificaciones'
    )
    titulo         = models.CharField(max_length=200)
    mensaje        = models.TextField()
    tipo           = models.CharField(max_length=30, choices=TIPOS)
    evento_titulo  = models.CharField(max_length=200)
    leida          = models.BooleanField(default=False)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'Notificacion'
        ordering = ['-leida', '-fecha_creacion']

    def __str__(self):
        return f'[{self.tipo}] {self.titulo} → {self.usuario.correo}'


class SolicitudAdmin(models.Model):
    """Solicitud de un docente para que su cuenta pase a rol administrador.
    Cuando un superusuario/admin la acepta, el rol del usuario cambia a 'admin'
    (ver ResolverSolicitudAdminView)."""

    ESTADO_PENDIENTE = 'pendiente'
    ESTADO_ACEPTADA = 'aceptada'
    ESTADO_RECHAZADA = 'rechazada'
    ESTADOS = [
        (ESTADO_PENDIENTE, 'Pendiente'),
        (ESTADO_ACEPTADA, 'Aceptada'),
        (ESTADO_RECHAZADA, 'Rechazada'),
    ]

    id_solicitud_admin = models.BigAutoField(primary_key=True)
    usuario = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='solicitudes_admin'
    )
    nombre = models.CharField(max_length=150)
    correo = models.CharField(max_length=100)
    plantel = models.CharField(max_length=100, blank=True, default='')
    turno = models.CharField(max_length=30, blank=True, default='')
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
        return f'{self.correo} ({self.estado})'
