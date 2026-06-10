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