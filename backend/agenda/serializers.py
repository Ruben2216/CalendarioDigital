from rest_framework import serializers
from .models import Notificacion


class LoginInstitucionalSerializer(serializers.Serializer):
    userName = serializers.CharField()
    password = serializers.CharField()
    rol = serializers.ChoiceField(choices=['superusuario', 'admin', 'docente', 'alumno', 'personal'])


class NotificacionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Notificacion
        fields = ['id', 'titulo', 'mensaje', 'tipo', 'evento_titulo', 'leida', 'fecha_creacion']
        read_only_fields = fields
