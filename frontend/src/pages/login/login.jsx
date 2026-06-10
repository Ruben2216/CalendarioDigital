import { useState } from "react";
import {Mail, Lock, Eye, EyeOff, CheckCircle2, ShieldCheck, Monitor, User, Home, Users, Clock, GraduationCap, LogIn,} from "lucide-react";
import logoCobach from "../../assets/img/logo-cobach.png";
import calendarImg from "../../assets/img/imagen-login.jpg";
import "./login.css";
import { GoogleLogin } from '@react-oauth/google';

const ROLES = [
  { id: "admin", label: "Administrador", icon: ShieldCheck },
  { id: "docente", label: "Docente", icon: Monitor },
  { id: "alumno", label: "Alumno", icon: User },
  { id: "tutor", label: "Padre/Tutor", icon: Home },
];

const FEATURES = [
  { icon: ShieldCheck, title: "Seguro", desc: "Protegemos tu información" },
  { icon: Users, title: "Confiable", desc: "Plataforma institucional" },
  { icon: Clock, title: "Disponible", desc: "Accede 24/7 desde cualquier lugar" },
  { icon: GraduationCap, title: "Educación", desc: "Comprometidos contigo" },
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("admin");

  const emailValid = /^[^\s@]+@cobach\.edu\.mx$/.test(email);

  const handleSubmit = (e) => {
    e.preventDefault();
    // conectar con la API de autenticacion o con google auth
    console.log({ email, password, role });
  };

  return (
    <div className="login">
      <div className="login__glow-beam" aria-hidden="true" />
      <div className="login__bg" aria-hidden="true" />

      <div className="login__top">
        {/* izquierdo (imagen) */}
        <div className="login__hero">
          <div className="login__dot-circle" aria-hidden="true" />
          <div className="login__dot-grid" aria-hidden="true" />
          <img
            className="login__hero-img"
            src={calendarImg}
            alt="Bienvenido a la agenda digital COBACH"
          />
          <div className="login__hero-content">
            <p className="login__hero-kicker">Bienvenido a</p>
            <h1 className="login__hero-title">
              la agenda digital <span>COBACH</span>
            </h1>
            <p className="login__hero-text">
              Accede a los servicios académicos, administrativos e
              institucionales.
            </p>
          </div>
        </div>

        {/* derecho (formulario) */}
        <aside className="login__panel">
          <form className="login__card" onSubmit={handleSubmit}>
            <img
              className="login__logo"
              src={logoCobach}
              alt="Colegio de Bachilleres de Chiapas"
            />

            <h2 className="login__title">Bienvenido</h2>
            <p className="login__subtitle">
              Ingresa con tus credenciales institucionales
            </p>

            {/* Correo */}
            <label className="login__label" htmlFor="email">
              Correo institucional
            </label>
            <div className="login__field">
              <Mail className="login__field-icon" />
              <input
                id="email"
                type="email"
                placeholder="usuario@cobach.edu.mx"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {emailValid && <CheckCircle2 className="login__field-check" />}
            </div>

            {/* Contraseña */}
            <label className="login__label" htmlFor="password">
              Contraseña
            </label>
            <div className="login__field">
              <Lock className="login__field-icon" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="login__eye"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>

            {/* Perfil de acceso (roles) */}
            <p className="login__label login__label--block">Perfil de acceso</p>
            <div className="login__roles">
              {ROLES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`login__role ${
                    role === id ? "login__role--active" : ""
                  }`}
                  onClick={() => setRole(id)}
                >
                  <Icon />
                  {label}
                </button>
              ))}
            </div>

            {/* Inicio de sesion / olvidar contraseña */}
            <button type="submit" className="login__submit">
              <LogIn />
              Iniciar sesión
            </button>
            <div className="google-btn">
              <GoogleLogin
                onSuccess={async (credentialResponse) => {
                  const id_token = credentialResponse?.credential;
                  if (!id_token) {
                    console.error('No credential returned from Google');
                    return;
                  }
                  try {
                    const backendBase = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
                    const callbackUrl = `${backendBase.replace(/\/$/, '')}/api/auth/google/callback/`;
                    console.log('Google callback URL:', callbackUrl);
                    if (!import.meta.env.VITE_BACKEND_URL) {
                      alert('VITE_BACKEND_URL no está definida. Usando fallback a localhost. Reinicia el servidor de frontend para cargar .env');
                    }
                    const resp = await fetch(callbackUrl, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept': 'application/json',
                      },
                      body: JSON.stringify({ token: id_token }),
                    });
                    if (!resp.ok) {
                      const errData = await resp.json().catch(() => ({}));
                      console.error('Backend error', errData);
                      return;
                    }
                    const data = await resp.json().catch(() => ({}));
                    if (data.redirect) {
                      window.location.href = data.redirect;
                      return;
                    }
                    if (data.token) {
                      localStorage.setItem('authToken', data.token);
                      window.location.href = '/dashboard.html';
                    }
                  } catch (err) {
                    console.error(err);
                  }
                }}
                onError={() => {
                  console.error('Google login failed');
                }}
              />
            </div>
            

            <p className="login__forgot">
              ¿Olvidaste tu contraseña?{" "}
              <a href="#recuperar">Recuperar acceso</a>
            </p>
          </form>
        </aside>
      </div>

      {/* Footer */}
      <footer className="login__footer">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <div className="login__feature" key={title}>
            <span className="login__feature-icon">
              <Icon />
            </span>
            <div>
              <p className="login__feature-title">{title}</p>
              <p className="login__feature-desc">{desc}</p>
            </div>
          </div>
        ))}
      </footer>
    </div>
  );
}
