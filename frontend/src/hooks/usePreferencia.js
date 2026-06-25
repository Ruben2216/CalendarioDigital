import { useState, useEffect } from "react";
import { obtenerSesion } from "../services/authService";

// Persistencia de preferencias de interfaz 
function espacioUsuario() {
  const s = obtenerSesion();
  return String(s?.id_usuario ?? s?.correo ?? s?.rol ?? "anon");
}

function claveCompleta(clave) {
  return `pref:${espacioUsuario()}:${clave}`;
}

function leer(clave, inicial) {
  try {
    const raw = localStorage.getItem(claveCompleta(clave));
    return raw === null ? inicial : JSON.parse(raw);
  } catch {
    return inicial;
  }
}

export function usePreferencia(clave, inicial) {
  const [valor, setValor] = useState(() => (clave ? leer(clave, inicial) : inicial));

  useEffect(() => {
    if (!clave) return;
    try {
      localStorage.setItem(claveCompleta(clave), JSON.stringify(valor));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [clave, valor]);

  return [valor, setValor];
}
