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


def mock_login_empleado(user_name: str, password: str) -> dict:
    """
    Simula POST /api/Seguridad/Login.
    Acepta userName corto ("ruben.admin") o correo completo ("ruben.admin@cobach.edu.mx").
    """
    if user_name.lower().endswith(_DOMINIO):
        correo = user_name.lower()
        user_name = user_name[: -len(_DOMINIO)]
    else:
        correo = f"{user_name}{_DOMINIO}"

    try:
        usuario = Usuario.objects.select_related('rol').get(correo=correo, activo=True)
    except Usuario.DoesNotExist:
        return FALLO_EMPLEADO

    if usuario.password_mock != password:
        return FALLO_EMPLEADO

    return {
        "exito": True,
        "statusLogueo": True,
        "idEmpleado": usuario.id_empleado,
        "userName": user_name,
        "nombre": usuario.nombre or "",
        "token": f"mock.jwt.{usuario.rol.nombre_rol}_{user_name}",
        "qr": _QR_PLACEHOLDER,
        "foto": _FOTO_PLACEHOLDER,
    }


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
