import requests

FALLO_EMPLEADO = {
    "exito": False, "statusLogueo": False,
    "idEmpleado": 0, "userName": "", "nombre": "",
    "token": "", "qr": "", "foto": "",
}

FALLO_ALUMNO = {"estatusLogin": 0}


_DOMINIO = '@cobach.edu.mx'

_URL_LOGIN_EMPLEADO = 'http://192.168.100.5:8087/api/Seguridad/Login'
_URL_LOGIN_ALUMNO = 'http://192.168.100.5:8087/api/Seguridad/LoginAlumnos'
_URL_DATOS_CORREO = 'http://192.168.100.5:8087/api/Seguridad/ObtenerDatosPorCorreo'


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


def login_alumno(usuario: str, password: str) -> dict:
    """
    POST /api/Seguridad/LoginAlumnos contra la API institucional.
    El alumno se autentica con su CURP (usuario) y su matrícula (password)
    """
    try:
        resp = requests.post(
            _URL_LOGIN_ALUMNO,
            json={'Usuario': usuario, 'Password': password},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return FALLO_ALUMNO


def obtener_datos_por_correo(correo: str) -> dict | None:
    """
    POST /api/Seguridad/ObtenerDatosPorCorreo?correo=...
    Sirve para saber a quién pertenece un correo institucional
    """
    try:
        resp = requests.post(
            _URL_DATOS_CORREO,
            params={'correo': correo},
            timeout=10,
        )
        resp.raise_for_status()
        datos = resp.json()
    except Exception:
        return None
    if not datos or not datos.get('correoInstitucional'):
        return None
    return datos


def es_alumno(datos: dict | None) -> bool:
    """True si los datos de ObtenerDatosPorCorreo corresponden a un alumno."""
    return bool(datos) and (datos.get('tipoEmpleado') or '').strip().lower() == 'alumno'
