import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/login/login.jsx";
import Layout from "./components/layout/Layout.jsx";
import EnConstruccion from "./pages/admin/EnConstruccion.jsx";

const Dashboard = lazy(() => import("./pages/admin/dashboard/dashboard.jsx"));
const Calendario = lazy(() => import("./pages/admin/calendario/calendario.jsx"));

function Cargando() {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
      Cargando…
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />

        <Route element={<Layout />}>
          <Route
            path="/dashboard"
            element={
              <Suspense fallback={<Cargando />}>
                <Dashboard />
              </Suspense>
            }
          />
          <Route
            path="/calendario"
            element={
              <Suspense fallback={<Cargando />}>
                <Calendario />
              </Suspense>
            }
          />
          <Route path="/eventos" element={<EnConstruccion titulo="Eventos" />} />
          <Route path="/usuarios" element={<EnConstruccion titulo="Usuarios" />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
