from django.contrib import admin
from django.urls import path
from agenda.views import (
    GoogleAuthView,
    LoginInstitucionalView,
    DocentesListView,
    ConversacionListView,
    MensajeListView,
    MarcarLeidoView,
    UsuarioListView,
    SolicitudAdminView,
    MiSolicitudAdminView,
    ResolverSolicitudAdminView,
    SolicitudBroadcastView,
    LogoutView,
    GuardarConfiguracionPlantelesView,
    TurnoListView,
    PlantelListView,
    CrearAdminView,
    ActualizarAdminView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/google/callback/', GoogleAuthView.as_view(), name='google-callback'),
    path('api/auth/login/', LoginInstitucionalView.as_view(), name='login-institucional'),
    
    path('api/planteles/', PlantelListView.as_view(), name='planteles-list'),
    path('api/turnos/', TurnoListView.as_view(), name='turnos-list'),

    # Solicitudes de acceso de administrador (docente → admin)
    path('api/solicitudes-admin/', SolicitudAdminView.as_view(), name='solicitudes-admin'),
    path('api/solicitudes-admin/mia/', MiSolicitudAdminView.as_view(), name='mi-solicitud-admin'),
    path('api/solicitudes-admin/<int:id_solicitud>/resolver/', ResolverSolicitudAdminView.as_view(), name='resolver-solicitud-admin'),
    path('api/usuarios/asignar-planteles/', GuardarConfiguracionPlantelesView.as_view(), name='asignar-planteles'),
    path('api/usuarios/crear-admin/', CrearAdminView.as_view(), name='crear-admin'),
    path('api/usuarios/<int:id_usuario>/actualizar/', ActualizarAdminView.as_view(), name='actualizar-admin'),

    # Mensajería
    path('api/usuarios/', UsuarioListView.as_view(), name='usuarios-list'),
    path('api/mensajeria/docentes/', DocentesListView.as_view(), name='docentes-list'),
    path('api/mensajeria/conversaciones/', ConversacionListView.as_view(), name='conversaciones'),
    path('api/mensajeria/conversaciones/<int:id_conv>/mensajes/', MensajeListView.as_view(), name='mensajes'),
    path('api/mensajeria/conversaciones/<int:id_conv>/leer/', MarcarLeidoView.as_view(), name='marcar-leido'),
    path('api/mensajeria/solicitudes/', SolicitudBroadcastView.as_view(), name='solicitud-broadcast'),
    path('api/auth/logout/', LogoutView.as_view(), name='logout'),
]
