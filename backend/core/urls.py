from django.contrib import admin
from django.urls import path
from agenda.views import GoogleAuthView, LoginInstitucionalView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/google/callback/', GoogleAuthView.as_view(), name='google-callback'),
    path('api/auth/login/', LoginInstitucionalView.as_view(), name='login-institucional'),
]
