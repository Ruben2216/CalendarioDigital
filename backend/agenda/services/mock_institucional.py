import requests

from agenda.models import Usuario

_QR_PLACEHOLDER = "data:image/png;base64,iVBORw0KGgo="
_FOTO_PLACEHOLDER = "data:image/jpeg;base64,/9j/4AAQ="

FALLO_EMPLEADO = {
    "exito": False, "statusLogueo": False,
    "idEmpleado": 0, "userName": "", "nombre": "",
    "token": "", "qr": "", "foto": "",
}

FALLO_ALUMNO = {
    "estatusLogin": 0, "matricula": "", "nombre": "",
    "token": "", "qr": "", "foto": "",
}


_DOMINIO = '@cobach.edu.mx'

_URL_LOGIN_EMPLEADO = 'http://192.168.100.5:8087/api/Seguridad/Login'
_URL_DATOS_POR_CORREO = 'http://192.168.100.5:8087/api/Seguridad/ObtenerDatosPorCorreo'


def mock_login_empleado(user_name: str, password: str) -> dict:
    try:
        resp = requests.post(
            _URL_LOGIN_EMPLEADO,
            json={'Usuario': user_name, 'Password': password},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return FALLO_EMPLEADO


def obtener_datos_por_correo(correo: str) -> dict:
    try:
        resp = requests.post(
            _URL_DATOS_POR_CORREO,
            params={'correo': correo},
            timeout=5,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return {}


def mock_login_alumno(user_name: str, password: str) -> dict:
    """
    Simula POST /api/Seguridad/LoginAlumnos.
    Busca al alumno por matrícula y valida su password_mock.
    """
    try:
        usuario = Usuario.objects.select_related('rol').get(
            matricula=user_name,
            activo=True,
        )
    except Usuario.DoesNotExist:
        return FALLO_ALUMNO

    if usuario.password_mock != password:
        return FALLO_ALUMNO

    return {
        "estatusLogin": 1,
        "matricula": usuario.matricula,
        "nombre": usuario.nombre or "",
        "token": f"mock.jwt.alumno_{user_name}",
        "qr": _QR_PLACEHOLDER,
        "foto": _FOTO_PLACEHOLDER,
    }
