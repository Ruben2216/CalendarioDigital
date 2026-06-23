from django.contrib import admin
from django.urls import path
from agenda.views import (
    GoogleAuthView,
    GoogleCalendarCallbackView,
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
    SesionActualView,
    GuardarConfiguracionPlantelesView,
    TurnoListView,
    PlantelListView,
    CrearAdminView,
    ActualizarAdminView,
    CalendarioListView,
    TipoEventoListView,
    TipoEventoDetailView,
    EventoListView,
    EventoDetailView,
    AnuncioListView,
    AnuncioDetailView,
    RegistrarDispositivoView,
    NotificacionListView,
    EstadisticasDashboardView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/google/callback/', GoogleAuthView.as_view(), name='google-callback'),
    path('api/auth/google/calendar/vincular/', GoogleCalendarCallbackView.as_view(), name='google-calendar-vincular'),
    path('api/auth/login/', LoginInstitucionalView.as_view(), name='login-institucional'),
    
    path('api/planteles/', PlantelListView.as_view(), name='planteles-list'),
    path('api/turnos/', TurnoListView.as_view(), name='turnos-list'),

    # Calendario y eventos
    path('api/calendarios/', CalendarioListView.as_view(), name='calendarios-list'),
    path('api/tipos-evento/', TipoEventoListView.as_view(), name='tipos-evento-list'),
    path('api/tipos-evento/<int:id_tipo>/', TipoEventoDetailView.as_view(), name='tipos-evento-detail'),
    path('api/eventos/', EventoListView.as_view(), name='eventos'),
    path('api/eventos/<int:id_evento>/', EventoDetailView.as_view(), name='evento-detail'),

    # Anuncios
    path('api/anuncios/', AnuncioListView.as_view(), name='anuncios'),
    path('api/anuncios/<int:id_anuncio>/', AnuncioDetailView.as_view(), name='anuncio-detail'),

    # Notificaciones push (FCM)
    path('api/dispositivos/registrar/', RegistrarDispositivoView.as_view(), name='registrar-dispositivo'),
    # Centro de notificaciones (campana)
    path('api/notificaciones/', NotificacionListView.as_view(), name='notificaciones'),

    # Estadísticas del dashboard (usuarios activos, etc.)
    path('api/estadisticas/dashboard/', EstadisticasDashboardView.as_view(), name='estadisticas-dashboard'),

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
    path('api/auth/sesion/', SesionActualView.as_view(), name='sesion-actual'),
]
