import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/login/login.jsx";
import Layout from "./components/layout/Layout.jsx";
import Dashboard from "./pages/admin/dashboard/dashboard.jsx";
import Calendario from "./pages/admin/calendario/calendario.jsx";
import EnConstruccion from "./pages/admin/EnConstruccion.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />

        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/eventos" element={<EnConstruccion titulo="Eventos" />} />
          <Route path="/usuarios" element={<EnConstruccion titulo="Usuarios" />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
