# Configuracion inicial de backend
dentro de backend
```
python -m venv venv 
```

si es bash la consola
venv\Scripts\activate    
pip install -r requirements.txt

# Estructura de carpetas en frontend:
1. components (vistas reutilizables, botones, inputs, etc)
2. pages (pantallas completas)
3. api o services (peticiones al backend)
4. hooks (controladores de logica de React)
5. routes (manejar navegacion entre páginas)
6. assets (imagenes y CSS global)

Instalar las dependencias:
```
npm install
```

Instalacion de React Router:
```
npm install react-router-dom
```

Iniciar frontend 
```
npm run dev
```

# Explicacion de libreria FullCalendar (calendario.jsx)
El calendario en sí (la rejilla) lo dibuja la librería FullCalendar:
- Esta página solo se encarga de:
     - El diseño de alrededor (encabezado, toolbar, simbología, tipos, filtros,
       panel de eventos del día y los modales de crear/editar/eliminar).
     - Pasarle a FullCalendar los datos y reaccionar a sus clics.

FullCalendar y sus plugins:
   - Cada plugin habilita un "tipo de vista". El nombre técnico de la vista es
   lo que luego usamos en changeView():
     - dayGridPlugin   -> "dayGridMonth"   (vista MES)
     - timeGridPlugin  -> "timeGridWeek"   (vista SEMANA, con horas)
     - multiMonthPlugin-> "multiMonthYear" (vista ANUAL, los 12 meses)
     - listPlugin      -> "listMonth"      (vista LISTA / agenda)
     - interactionPlugin-> habilita los clics en días (dateClick)
   esLocale traduce la librería al español. */

Se utilizaron 4 vistas (mes, semana, anual y lista)

# Solicitudes de acceso de administrador (docente → admin)

Flujo: un docente, ya logueado, pide pasar a administrador. Un superusuario/admin
la aprueba y, en ese momento, **el rol del usuario cambia de docente a admin**.

## Backend (app `agenda`)
- Modelo: `SolicitudAdmin` (usuario, nombre, correo, plantel, turno, motivo, estado,
  resuelta_por, fechas). Estados: `pendiente`, `aceptada`, `rechazada`.
- Endpoints (en `core/urls.py`):
  - `POST /api/solicitudes-admin/` — crea la solicitud. Si el usuario ya tiene una
    pendiente, devuelve esa misma con `ya_existe: true` (no crea otra).
  - `GET  /api/solicitudes-admin/mia/?id_usuario=<id>` — la solicitud pendiente del usuario.
  - `GET  /api/solicitudes-admin/` — lista (para el admin); filtro opcional `?estado=`.
  - `POST /api/solicitudes-admin/<id>/resolver/` — body `{accion: "aceptar"|"rechazar", id_usuario}`.

## >>> PUNTO DEL CAMBIO DE ROL <<<
Está en `agenda/views.py`, dentro de `ResolverSolicitudAdminView.post`, en la rama
`accion == "aceptar"`: ahí se hace `usuario.rol = rol_admin; usuario.save()`.
Ese es el lugar exacto donde el docente se convierte en admin.

## IMPORTANTE: aplicar la migración
Se agregó el modelo nuevo, así que hay que correr (dentro de `backend/`, con el venv):
```
python manage.py migrate
```
Si Django no detecta la migración: `python manage.py makemigrations agenda` y luego `migrate`.

# Lista eventos visibles según el rol y crea eventos (admin/superusuario)

Regla de visibilidad (plantel y turno se evalúan por separado;
-  `null` = "paratodos"). 
- Un evento es visible si:
  - (plantel del evento es null o es uno de los del usuario)    y (turno del evento es null o coincide con el del usuario)

Matices por rol:
- superusuario: todos los eventos del calendario.
- admin: ve ambos turnos de su(s) plantel(es), por eso NO restringe turno.
- docente / alumno: respetan plantel Y turno (no ven el otro turno).
- úblico (sin sesión): solo eventos totalmente generales (plantel y turno
        nulos) de calendarios públicos.