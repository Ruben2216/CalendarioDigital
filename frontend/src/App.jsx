import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from "react-router-dom";
import { MensajeriaProvider } from "./context/MensajeriaContext.jsx";
import { SolicitudesProvider } from "./context/SolicitudesContext.jsx";
import { inicializarNotificaciones } from "./services/pushService.js";
import Login from "./pages/login/login.jsx";
import GoogleCalendarCallback from "./pages/google-calendar-callback/GoogleCalendarCallback.jsx";
import Layout from "./components/layout/Layout.jsx";
import LayoutDocente from "./components/layout/LayoutDocente.jsx";
import LayoutAlumno from "./components/layout/LayoutAlumno.jsx";

const Dashboard        = lazy(() => import("./pages/admin/dashboard/dashboard.jsx"));
const Calendario       = lazy(() => import("./pages/admin/calendario/calendario.jsx"));
const Mensajeria       = lazy(() => import("./pages/admin/mensajeria/Mensajeria.jsx"));
const Usuarios         = lazy(() => import("./pages/admin/usuarios/usuarios.jsx"));
const Solicitudes      = lazy(() => import("./pages/admin/solicitudes/solicitudes.jsx"));
const Anuncios         = lazy(() => import("./pages/admin/anuncios/anuncios.jsx"));
const ForoDocente      = lazy(() => import("./pages/docente/foro/ForoDocente.jsx"));
const DocenteInicio    = lazy(() => import("./pages/docente/inicio.jsx"));
const AlumnoInicio     = lazy(() => import("./pages/alumno/inicio.jsx"));
const Alumno           = lazy(() => import("./pages/alumno/alumno.jsx"));
const AnunciosVista    = lazy(() => import("./components/anuncios/AnunciosVista.jsx"));

function Cargando() {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
      Cargando…
    </div>
  );
}

function ProtectedRoute({ roles }) {
  const token = localStorage.getItem('authToken');
  if (!token) return <Navigate to="/login" replace />;

  if (roles && roles.length > 0) {
    const raw = localStorage.getItem('sesion');
    const sesion = raw ? JSON.parse(raw) : null;
    if (!sesion || !roles.includes(sesion.rol)) {
      return <Navigate to="/login" replace />;
    }
  }

  return <Outlet />;
}

function RedireccionNotif() {
  const { destino } = useParams();
  const raw = localStorage.getItem('sesion');
  const sesion = raw ? JSON.parse(raw) : null;
  if (!sesion) return <Navigate to="/login" replace />;

  const mapa = {
    admin:        { anuncios: '/anuncios', calendario: '/calendario', inicio: '/dashboard' },
    superusuario: { anuncios: '/anuncios', calendario: '/calendario', inicio: '/dashboard' },
    colaborador:  { anuncios: '/anuncios', calendario: '/calendario', inicio: '/dashboard' },
    docente:      { anuncios: '/docente/anuncios', calendario: '/docente/calendario', inicio: '/docente/inicio' },
    alumno:       { anuncios: '/alumno/anuncios', calendario: '/alumno/calendario', inicio: '/alumno/inicio' },
    tutor:        { anuncios: '/tutor/calendario', calendario: '/tutor/calendario', inicio: '/tutor/calendario' },
  };
  const rutas = mapa[sesion.rol] || {};
  return <Navigate to={rutas[destino] || rutas.inicio || '/login'} replace />;
}

function App() {
  // Registra el token FCM también al recargar la app si ya hay sesión iniciada
  useEffect(() => {
    const raw = localStorage.getItem('sesion');
    if (!raw) return;
    let s;
    try { s = JSON.parse(raw); } catch { return; }
    if (!s?.rol || s.rol === 'tutor') return;

    const planteles = Array.isArray(s.planteles)
      ? s.planteles.map((p) => p.plantel).filter(Boolean)
      : [];
    const plano = s.plantel ?? planteles[0] ?? null;
    inicializarNotificaciones({
      id_usuario: s.id_usuario ?? null,
      rol: s.rol,
      planteles,
      plantel_id: plano?.id ?? null,
      plantel_nombre: plano?.nombre ?? null,
    }).catch(() => {});
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"      element={<Login />} />
        <Route path="/login" element={<Login />} />

        {/* Destino de las notificaciones push (redirige según rol) */}
        <Route path="/ir/:destino" element={<RedireccionNotif />} />

        {/* Consulta pública del calendario (sin cuenta): solo eventos generales */}
        <Route
          path="/consulta"
          element={<Suspense fallback={<Cargando />}><Calendario publico /></Suspense>}
        />

        {/* Rutas admin / superusuario / colaborador */}
        <Route element={<ProtectedRoute roles={['admin', 'superusuario', 'colaborador']} />}>
          <Route element={<MensajeriaProvider><SolicitudesProvider><Layout /></SolicitudesProvider></MensajeriaProvider>}>
            <Route path="/dashboard"  element={<Suspense fallback={<Cargando />}><Dashboard /></Suspense>} />
            <Route path="/calendario" element={<Suspense fallback={<Cargando />}><Calendario /></Suspense>} />
            <Route path="/anuncios"   element={<Suspense fallback={<Cargando />}><Anuncios /></Suspense>} />
          </Route>
        </Route>

        {/* Ruta Mensajería: admin y superusuario (el colaborador no participa) */}
        <Route element={<ProtectedRoute roles={['admin', 'superusuario']} />}>
          <Route element={<MensajeriaProvider><SolicitudesProvider><Layout /></SolicitudesProvider></MensajeriaProvider>}>
            <Route path="/mensajeria" element={<Suspense fallback={<Cargando />}><Mensajeria /></Suspense>} />
            {/* Solicitudes de visualización de plantel y cambio de turno */}
            <Route path="/solicitudes" element={<Suspense fallback={<Cargando />}><Solicitudes /></Suspense>} />
          </Route>
        </Route>

        {/* Ruta Usuarios: solo superusuario */}
        <Route element={<ProtectedRoute roles={['superusuario']} />}>
          <Route element={<MensajeriaProvider><SolicitudesProvider><Layout /></SolicitudesProvider></MensajeriaProvider>}>
            <Route path="/usuarios" element={<Suspense fallback={<Cargando />}><Usuarios /></Suspense>} />
          </Route>
        </Route>

        {/* Rutas alumno (solo lectura) */}
        <Route element={<ProtectedRoute roles={['alumno']} />}>
          <Route element={<LayoutAlumno />}>
            <Route path="/alumno/inicio"     element={<Suspense fallback={<Cargando />}><AlumnoInicio /></Suspense>} />
            <Route path="/alumno/calendario" element={<Suspense fallback={<Cargando />}><Alumno /></Suspense>} />
            <Route path="/alumno/anuncios"   element={<Suspense fallback={<Cargando />}><AnunciosVista /></Suspense>} />
          </Route>
        </Route>

        {/* Rutas padre/tutor (solo lectura del calendario general) */}
        <Route element={<ProtectedRoute roles={['tutor']} />}>
          <Route element={<LayoutAlumno />}>
            <Route path="/tutor/calendario" element={<Suspense fallback={<Cargando />}><Calendario soloLectura /></Suspense>} />
          </Route>
        </Route>

        {/* Rutas docente */}
        <Route element={<ProtectedRoute roles={['docente']} />}>
          <Route element={<MensajeriaProvider><LayoutDocente /></MensajeriaProvider>}>
            <Route path="/docente/inicio"     element={<Suspense fallback={<Cargando />}><DocenteInicio /></Suspense>} />
            <Route path="/docente/calendario" element={<Suspense fallback={<Cargando />}><Calendario soloLectura /></Suspense>} />
            <Route path="/docente/anuncios"   element={<Suspense fallback={<Cargando />}><AnunciosVista /></Suspense>} />
            <Route path="/docente/foro"       element={<Suspense fallback={<Cargando />}><ForoDocente /></Suspense>} />
          </Route>
        </Route>

        {/* Callback OAuth2 para vincular Google Calendar */}
        <Route path="/calendar/callback" element={<GoogleCalendarCallback />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
