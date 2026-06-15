import { useState, useEffect, useRef } from "react";
import {Lock, Eye, EyeOff, CheckCircle2, ShieldCheck, Monitor, User, Home, Users, Clock, GraduationCap, LogIn,} from "lucide-react";
import { useNavigate } from "react-router-dom";
import logoCobach from "../../assets/img/logo-cobach.png";
import calendarImg from "../../assets/img/imagen-login.jpg";
import "./login.css";
import Swal from 'sweetalert2';
import { loginInstitucional, guardarSesion } from '../../services/authService';

const ROLES = [
  { id: "admin", label: "Administrador", icon: ShieldCheck },
  { id: "docente", label: "Docente", icon: Monitor },
  { id: "alumno", label: "Alumno", icon: User },
  { id: "tutor", label: "Padre/Tutor", icon: Home },
];

const INSTITUTIONAL_ROLES = new Set(["admin", "docente", "alumno"]);

const FEATURES = [
  { icon: ShieldCheck, title: "Seguro", desc: "Protegemos tu información" },
  { icon: Users, title: "Confiable", desc: "Plataforma institucional" },
  { icon: Clock, title: "Disponible", desc: "Accede 24/7 desde cualquier lugar" },
  { icon: GraduationCap, title: "Educación", desc: "Comprometidos contigo" },
];

export default function Login() {
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("admin");
  const navigate = useNavigate();
  const roleRef = useRef(role);

  const isInstitutionalAccess = INSTITUTIONAL_ROLES.has(role);
  const isPublicAccess = role === "tutor";

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const id_token = params.get('id_token');
    if (id_token && window.opener) {
      window.opener.postMessage({ type: 'google-oauth', id_token }, window.location.origin);
      window.close();
    }
  }, []);

  useEffect(() => {
    const handleMessage = async (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'google-oauth') return;
      const { id_token } = event.data;
      if (!id_token) return;

      const currentRole = roleRef.current;
      try {
        let backendBase = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          backendBase = 'http://localhost:8000';
        }
        const callbackUrl = `${backendBase.replace(/\/$/, '')}/api/auth/google/callback/`;
        const resp = await fetch(callbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json',
            'ngrok-skip-browser-warning': '1',
          },
          body: JSON.stringify({ token: id_token, role: currentRole }),
        });
        if (resp.status === 204) {
          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'Solo se permiten cuentas institucionales',
          });
          return;
        }
        if (!resp.ok) {
          if (resp.status === 403) {
            Swal.fire({
              icon: 'error',
              title: 'Oops...',
              text: 'Rol no permitido para acceso institucional',
            });
            return;
          }
          const errData = await resp.json().catch(() => ({}));
          console.error('Backend error', errData);
          return;
        }
        const data = await resp.json().catch(() => ({}));
        if (data.token) {
          localStorage.setItem('authToken', data.token);
          switch (currentRole) {
            case 'admin':
              navigate('/dashboard');
              break;
            case 'docente':
              navigate('/docente/calendario');
              break;
            case 'alumno':
              navigate('/alumno/calendario');
              break;
            default:
              navigate('/dashboard');
          }
          return;
        }
        if (data.redirect) {
          window.location.href = data.redirect.replace('.html', '');
        }
      } catch (err) {
        console.error(err);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate]);

  const handleGoogleLogin = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const redirectUri = `${window.location.origin}/login`;
    const nonce = crypto.randomUUID?.() ?? Math.random().toString(36).substring(2);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'id_token',
      scope: 'openid email profile',
      nonce,
      prompt: 'select_account',
    });

    const w = 500;
    const h = 600;
    const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
    const top = Math.round(window.screenY + (window.outerHeight - h) / 2);

    const popup = window.open(
      `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      'google-login',
      `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );

    if (!popup) {
      Swal.fire({
        icon: 'warning',
        title: 'Popup bloqueado',
        text: 'Permite ventanas emergentes para este sitio e intenta de nuevo.',
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isPublicAccess) {
      localStorage.setItem("authToken", "tutor-public-token");
      navigate("/dashboard");
      return;
    }

    const resultado = await loginInstitucional(userName, password, role);

    if (!resultado.exito) {
      Swal.fire({
        icon: "error",
        title: "Acceso denegado",
        text: resultado.error,
      });
      return;
    }

    const { token, nombre, sesion } = resultado.datos;
    guardarSesion(token, { ...sesion, nombre });

    switch (sesion?.rol ?? role) {
      case 'docente':
        navigate('/docente/calendario');
        break;
      case 'alumno':
        navigate('/alumno/calendario');
        break;
      default:
        navigate('/dashboard');
    }
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
              {isPublicAccess
                ? "Acceso público a la agenda escolar"
                : "Ingresa con tus credenciales institucionales"}
            </p>

            {isInstitutionalAccess && (
              <>
                <label className="login__label" htmlFor="userName">
                  {role === "alumno" ? "Matrícula" : "Usuario/correo institucional"}
                </label>
                <div className="login__field">
                  <User className="login__field-icon" />
                  <input
                    id="userName"
                    type="text"
                    placeholder={role === "alumno" ? "A123456" : "usuario o correo@cobach.edu.mx"}
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    required
                  />
                  {userName.length >= 4 && (
                    <CheckCircle2 className="login__field-check" />
                  )}
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
              </>
            )}

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
              {isPublicAccess ? "Acceder" : "Iniciar sesión"}
            </button>

            {isInstitutionalAccess && (
              <button type="button" className="google-btn" onClick={handleGoogleLogin}>
                <div className="google-btn__visual">
                  <svg
                    className="google-icon"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span className="google-text">Iniciar sesión con Google</span>
                </div>
              </button>
            )}

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
