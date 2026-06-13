from rest_framework import serializers


class LoginInstitucionalSerializer(serializers.Serializer):
    userName = serializers.CharField()
    password = serializers.CharField()
    rol = serializers.ChoiceField(choices=['superusuario', 'admin', 'docente', 'alumno'])
