import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { MensajeriaProvider } from "./context/MensajeriaContext.jsx";
import Login from "./pages/login/login.jsx";
import Layout from "./components/layout/Layout.jsx";
import LayoutDocente from "./components/layout/LayoutDocente.jsx";
import LayoutAlumno from "./components/layout/LayoutAlumno.jsx";
import EnConstruccion from "./pages/admin/EnConstruccion.jsx";

const Dashboard        = lazy(() => import("./pages/admin/dashboard/dashboard.jsx"));
const Calendario       = lazy(() => import("./pages/admin/calendario/calendario.jsx"));
const Mensajeria       = lazy(() => import("./pages/admin/mensajeria/Mensajeria.jsx"));
const Usuarios         = lazy(() => import("./pages/admin/usuarios/usuarios.jsx"));
const CalendarioDocente = lazy(() => import("./pages/admin/calendario/calendario.jsx"));
const ForoDocente      = lazy(() => import("./pages/docente/foro/ForoDocente.jsx"));
const Alumno           = lazy(() => import("./pages/alumno/alumno.jsx"));

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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"      element={<Login />} />
        <Route path="/login" element={<Login />} />

        {/* Rutas admin / superusuario */}
        <Route element={<ProtectedRoute roles={['admin', 'superusuario']} />}>
          <Route element={<MensajeriaProvider><Layout /></MensajeriaProvider>}>
            <Route path="/dashboard"  element={<Suspense fallback={<Cargando />}><Dashboard /></Suspense>} />
            <Route path="/calendario" element={<Suspense fallback={<Cargando />}><Calendario /></Suspense>} />
            <Route path="/eventos"    element={<EnConstruccion titulo="Eventos" />} />
            <Route path="/mensajeria" element={<Suspense fallback={<Cargando />}><Mensajeria /></Suspense>} />
            <Route path="/usuarios"   element={<Suspense fallback={<Cargando />}><Usuarios /></Suspense>} />
          </Route>
        </Route>

        {/* Rutas alumno (solo lectura) */}
        <Route element={<ProtectedRoute roles={['alumno']} />}>
          <Route element={<LayoutAlumno />}>
            <Route path="/alumno/calendario" element={<Suspense fallback={<Cargando />}><Alumno /></Suspense>} />
          </Route>
        </Route>

        {/* Rutas docente */}
        <Route element={<ProtectedRoute roles={['docente']} />}>
          <Route element={<MensajeriaProvider><LayoutDocente /></MensajeriaProvider>}>
            <Route path="/docente/calendario" element={<Suspense fallback={<Cargando />}><CalendarioDocente soloLectura /></Suspense>} />
            <Route path="/docente/foro"       element={<Suspense fallback={<Cargando />}><ForoDocente /></Suspense>} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
