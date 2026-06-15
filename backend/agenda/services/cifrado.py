import os
import base64

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _clave() -> bytes:
    return bytes.fromhex(os.environ['MENSAJE_SECRET_KEY'])


def cifrar(texto: str) -> tuple[str, str]:
    """Devuelve (contenido_b64, iv_b64). IV único aleatorio por llamada."""
    iv = os.urandom(12)
    ct = AESGCM(_clave()).encrypt(iv, texto.encode('utf-8'), None)
    return base64.b64encode(ct).decode(), base64.b64encode(iv).decode()


def descifrar(contenido_b64: str, iv_b64: str) -> str:
    iv = base64.b64decode(iv_b64)
    ct = base64.b64decode(contenido_b64)
    return AESGCM(_clave()).decrypt(iv, ct, None).decode('utf-8')
