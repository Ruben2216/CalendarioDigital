from django.shortcuts import redirect
from django.conf import settings

import requests

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions


class GoogleAuthView(APIView):
	"""Verifica el ID token de Google y redirige al dashboard si el dominio es válido.

	No se usa base de datos por ahora; la función únicamente valida el token
	y fuerza la redirección a `FRONTEND_DASHBOARD_URL` cuando el correo pertenece
	a `@cobach.edu.mx`. En caso contrario no realiza acción (responde 204).
	"""

	permission_classes = [permissions.AllowAny]

	def post(self, request):
		id_token = request.data.get('token') or request.POST.get('token')
		if not id_token:
			return Response(status=status.HTTP_204_NO_CONTENT)

		tokeninfo_url = 'https://oauth2.googleapis.com/tokeninfo'
		try:
			resp = requests.get(tokeninfo_url, params={'id_token': id_token}, timeout=5)
		except requests.RequestException:
			return Response(status=status.HTTP_503_SERVICE_UNAVAILABLE)

		if resp.status_code != 200:
			return Response(status=status.HTTP_400_BAD_REQUEST)

		datos = resp.json()

		# Verificar audiencia (opcional si se configura)
		expected_aud = getattr(settings, 'GOOGLE_OAUTH2_CLIENT_ID', '')
		if expected_aud and datos.get('aud') != expected_aud:
			return Response(status=status.HTTP_400_BAD_REQUEST)

		correo = datos.get('email')
		correo_verificado = datos.get('email_verified') in (True, 'true', 'True', '1')
		if not correo or not correo_verificado:
			return Response(status=status.HTTP_204_NO_CONTENT)

		# Forzar dominio institucional
		if not correo.endswith('@cobach.edu.mx'):
			return Response(status=status.HTTP_204_NO_CONTENT)

		# Preferir origen dinámico cuando la petición proviene de un frontend autorizado
		origin = request.headers.get('origin') or request.META.get('HTTP_ORIGIN')

		# lista de orígenes permitidos desde settings
		allowed = getattr(settings, 'CORS_ALLOWED_ORIGINS', [])
		# incluir FRONTEND_DASHBOARD_URL como respaldo
		fallback = getattr(settings, 'FRONTEND_DASHBOARD_URL', 'http://localhost:5173/dashboard.html')

		def origin_allowed(o: str) -> bool:
			if not o:
				return False
			# comparar exactamente
			if o in allowed:
				return True
			# permitir coincidencias por sufijo (ej. .ngrok-free.app)
			for a in allowed:
				if a.startswith('.') and o.endswith(a):
					return True
				if a.startswith('http') and o == a:
					return True
				# también comparar sin esquema
				try:
					host = o.split('://', 1)[1]
				except Exception:
					host = o
				if a == host or (a.startswith('.') and host.endswith(a.lstrip('.'))):
					return True
			return False

		if origin and origin_allowed(origin):
			redirect_url = origin.rstrip('/') + '/dashboard.html'
		else:
			redirect_url = fallback

		# Si la petición proviene de XHR/Fetch, devolver la URL en JSON; si es navegación normal, redirigir
		is_xhr = request.headers.get('x-requested-with') == 'XMLHttpRequest' or 'application/json' in request.headers.get('accept', '')
		if is_xhr:
			return Response({'redirect': redirect_url}, status=status.HTTP_200_OK)

		return redirect(redirect_url)
