"""
Notificaciones push con Firebase Cloud Messaging (arquitectura de Topics)
 (topics):
    tema_todos              -> todos los dispositivos registrados
    tema_rol_{rol}          -> p. ej. tema_rol_alumno, tema_rol_docente
    tema_plantel_{id}       -> p. ej. tema_plantel_3
"""

import threading

import firebase_admin
from firebase_admin import credentials, messaging
from django.conf import settings

TEMA_TODOS = 'tema_todos'

_lock = threading.Lock()
_app = None

def _get_app():
    global _app
    if _app is not None:
        return _app
    with _lock:
        if _app is None:
            cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_FILE)
            _app = firebase_admin.initialize_app(cred)
    return _app

def tema_rol(rol: str) -> str:
    return f'tema_rol_{rol}'

def tema_plantel(id_plantel) -> str:
    return f'tema_plantel_{id_plantel}'

def suscribir(token: str, temas: list[str]) -> None:
    _get_app()
    for tema in temas:
        messaging.subscribe_to_topic([token], tema)

def desuscribir(token: str, temas: list[str]) -> None:
    _get_app()
    for tema in temas:
        messaging.unsubscribe_from_topic([token], tema)

def sincronizar(token: str, deseados: list[str], previos: list[str]) -> list[str]:
    _get_app()
    prev = set(previos or [])
    des = set(deseados or [])
    for tema in prev - des:
        messaging.unsubscribe_from_topic([token], tema)
    for tema in des - prev:
        messaging.subscribe_to_topic([token], tema)
    return sorted(des)

def enviar_a_temas(temas: list[str], titulo: str, cuerpo: str, data: dict | None = None) -> str:
    _get_app()
    payload = {'title': titulo, 'body': cuerpo}
    payload.update({k: str(v) for k, v in (data or {}).items()})

    if len(temas) == 1:
        mensaje = messaging.Message(data=payload, topic=temas[0])
    else:
        condicion = ' && '.join(f"'{t}' in topics" for t in temas)
        mensaje = messaging.Message(data=payload, condition=condicion)

    return messaging.send(mensaje)

def enviar_anuncio(anuncio) -> str:
    """Envía un anuncio al tema correspondiente según plantel + audiencia.
    - Con plantel  -> tema_plantel_{id}
    - Audiencia distinta de 'todos' -> + tema_rol_{audiencia}
    - Sin plantel ni audiencia específica -> tema_todos
    """
    temas: list[str] = []
    if anuncio.plantel_id:
        temas.append(tema_plantel(anuncio.plantel_id))
    if anuncio.audiencia and anuncio.audiencia != 'todos':
        temas.append(tema_rol(anuncio.audiencia))
    if not temas:
        temas = [TEMA_TODOS]

    return enviar_a_temas(
        temas,
        anuncio.titulo,
        (anuncio.descripcion or '')[:1500],
        {'tipo': 'anuncio', 'id_anuncio': anuncio.id_anuncio, 'url': '/ir/anuncios'},
    )
