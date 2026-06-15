import json

from django.db import models


class Rol(models.Model):
    nombre_rol = models.CharField(max_length=50, unique=True)

    class Meta:
        db_table = 'Rol'

    def __str__(self):
        return self.nombre_rol


class Plantel(models.Model):
    clave = models.CharField(max_length=10, unique=True)
    nombre = models.CharField(max_length=100)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'Plantel'

    def __str__(self):
        return self.nombre


class Turno(models.Model):
    plantel = models.ForeignKey(
        Plantel, on_delete=models.CASCADE, related_name='turnos'
    )
    nombre_turno = models.CharField(max_length=30)

    class Meta:
        db_table = 'Turno'

    def __str__(self):
        return f'{self.nombre_turno} — {self.plantel.nombre}'


class Grupo(models.Model):
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
    rol = models.ForeignKey(
        Rol, on_delete=models.PROTECT, related_name='usuarios'
    )
    plantel = models.ForeignKey(
        Plantel, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='usuarios'
    )
    turno = models.ForeignKey(
        Turno, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='usuarios'
    )
    correo = models.CharField(max_length=100, unique=True)
    nombre = models.CharField(max_length=150, null=True, blank=True)
    google_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    id_empleado = models.IntegerField(null=True, blank=True)
    matricula = models.CharField(max_length=20, null=True, blank=True)
    password_mock = models.CharField(max_length=128, null=True, blank=True)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'Usuario'

    def __str__(self):
        return f'{self.correo} ({self.rol.nombre_rol})'


class PermisoEspecial(models.Model):
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


class Conversacion(models.Model):
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
        """Garantiza que participante_a.id siempre sea el menor."""
        return (min(id_a, id_b), max(id_a, id_b))

    def es_participante(self, id_usuario: int) -> bool:
        return id_usuario in (self.participante_a_id, self.participante_b_id)


class Mensaje(models.Model):
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
