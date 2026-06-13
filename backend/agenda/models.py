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
