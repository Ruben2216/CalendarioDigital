from django.shortcuts import redirect
from django.conf import settings

import requests

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions


class GoogleAuthView(APIView):
	"""Verifica el ID token de Google y redirige al dashboard si el dominio es válido."""

	INSTITUTIONAL_ROLES = frozenset({'admin', 'docente', 'alumno'})
	permission_classes = [permissions.AllowAny]

	def post(self, request):
		role = request.data.get('role') or request.POST.get('role')
		if role and role not in self.INSTITUTIONAL_ROLES:
			return Response(status=status.HTTP_403_FORBIDDEN)

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

		print(f"correo: {datos.get('email')}")
		print(f"google_id: {datos.get('sub')}")
		print(f"nombre: {datos.get('given_name')}")
		print(f"apellidos: {datos.get('family_name')}")

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
		fallback = getattr(settings, 'FRONTEND_DASHBOARD_URL', 'http://localhost:5173/dashboard')

		def origin_allowed(o: str) -> bool:
			if not o:
				return False
			# permitir ngrok por defecto
			if "ngrok-free.app" in o:
				return True
			if o in allowed:
				return True
			# permitir coincidencias por sufijo (ej. .ngrok-free.app)
			for a in allowed:
				if a.startswith('.') and o.endswith(a):
					return True
				if a.startswith('http') and o == a:
					return True
				try:
					host = o.split('://', 1)[1]
				except Exception:
					host = o
				if a == host or (a.startswith('.') and host.endswith(a.lstrip('.'))):
					return True
			return False

		if origin and origin_allowed(origin):
			redirect_url = origin.rstrip('/') + '/dashboard'
		else:
			redirect_url = fallback.replace('.html', '')

		# Dummy token por ahora (se reemplazará cuando haya BD)
		dummy_token = f"dummy-token-{correo}"

		# Si la petición proviene de XHR/Fetch, devolver la URL en JSON; si es navegación normal, redirigir
		is_xhr = request.headers.get('x-requested-with') == 'XMLHttpRequest' or 'application/json' in request.headers.get('accept', '')
		if is_xhr:
			return Response({'redirect': redirect_url, 'token': dummy_token}, status=status.HTTP_200_OK)

		return redirect(redirect_url)
