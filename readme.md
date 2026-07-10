<div align="center">
  <img src="frontend/src/assets/img/logo-cobach.png" width="160" alt="COBACH Logo">

  <h1>Calendario Digital</h1>
  <p><b>Sistema de calendario institucional — COBACH</b></p>

  <p>
    <a href="#requisitos-previos">Requisitos</a> •
    <a href="#1-backend-django">Backend</a> •
    <a href="#2-frontend-react--vite">Frontend</a> •
    <a href="#estructura-de-carpetas-en-frontend">Estructura</a> •
    <a href="#solicitudes-de-acceso-de-administrador-docente--admin">Roles y permisos</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Django-6.0.5-092E20?logo=django&logoColor=white" alt="Django">
    <img src="https://img.shields.io/badge/DRF-3.17.1-A30000?logo=django&logoColor=white" alt="Django REST Framework">
    <img src="https://img.shields.io/badge/React-19.2.6-61DAFB?logo=react&logoColor=black" alt="React">
    <img src="https://img.shields.io/badge/Vite-8.0.12-646CFF?logo=vite&logoColor=white" alt="Vite">
    <img src="https://img.shields.io/badge/Node-20.19+-339933?logo=node.js&logoColor=white" alt="Node">
    <img src="https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white" alt="Python">
    <img src="https://img.shields.io/badge/DB-SQL_Server-CC2927?logo=microsoftsqlserver&logoColor=white" alt="SQL Server">
  </p>
</div>

---

Proyecto con **backend Django** (`/backend`) y **frontend React + Vite** (`/frontend`).

## Requisitos previos

| Herramienta | Versión mínima | Notas |
|-------------|----------------|-------|
| Python      | **3.12**       | Requerido por Django 6.0. Verificar con `python --version`. |
| Node.js     | **20.19+**     | Requerido por Vite 8. Verificar con `node --version`. |
| SQL Server + ODBC Driver 17 for SQL Server | — | Base de datos del backend (motor `mssql`). |

---

## 1. Backend (Django)

Todos los comandos se ejecutan **dentro de la carpeta `backend/`**.

### 1.1. Crear el entorno virtual

```bash
cd backend
python -m venv venv
```

### 1.2. Activar el entorno virtual

Según la consola que uses:

```powershell
# PowerShell Windows
venv\Scripts\Activate.ps1
```
```bat
:: CMD Windows
venv\Scripts\activate.bat
```
```bash
# Terminal macOS
source venv/bin/activate
```

Si PowerShell bloquea el script de activación, ejecuta una vez:
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

Con el entorno activo verás el prefijo `(venv)` en la terminal.

### 1.3. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 1.4. Crear el archivo `.env`

Ubicación: **`backend/.env`** (misma carpeta que `manage.py`). Contenido:


### 1.5. Aplicar migraciones y arrancar

```bash
python manage.py runserver 0.0.0.0:8000        # http://localhost:8000
```

---

## 2. Frontend (React + Vite)

Todos los comandos se ejecutan **dentro de la carpeta `frontend/`**.

### 2.1. Instalar dependencias

```bash
cd frontend
npm install
```


### 2.2. Crear el archivo `.env`

Ubicación: **`frontend/.env`** (raíz del frontend, junto a `package.json`):


### 2.3. Arrancar en desarrollo

```bash
npm run dev                       # http://localhost:5173
```
---

## Estructura de carpetas en frontend

1. components (vistas reutilizables, botones, inputs, etc)
2. pages (pantallas completas)
3. api o services (peticiones al backend)
4. hooks (controladores de logica de React)
5. routes (manejar navegacion entre páginas)
6. assets (imagenes y CSS global)

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