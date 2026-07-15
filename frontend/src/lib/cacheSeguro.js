import CryptoJS from 'crypto-js';

// The key should be defined in an environment variable, e.g. VITE_CACHE_SECRET_KEY
// Fallback is provided only to prevent crashing if not set, but the environment variable MUST be used.
const SECRET_KEY = import.meta.env.VITE_CACHE_SECRET_KEY || 'default_secret_key_for_development_only';

/**
 * Cifra un payload (objeto o arreglo) usando AES y devuelve la cadena cifrada.
 */
function encryptData(data) {
  return CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
}

/**
 * Descifra una cadena cifrada usando AES y devuelve el payload original.
 */
function decryptData(ciphertext) {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedStr);
  } catch (error) {
    console.error("Error al descifrar los datos de la caché:", error);
    return null;
  }
}

/**
 * Guarda datos en localStorage cifrados, con un tiempo de vida (TTL).
 * @param {string} key - Clave del localStorage
 * @param {any} data - Datos a guardar
 * @param {number} ttlMs - Tiempo de vida en milisegundos (por defecto 5 minutos)
 */
export function setCacheSegura(key, data, ttlMs = 300000) {
  const payloadCifrado = encryptData(data);
  const cacheObj = {
    payload: payloadCifrado,
    creacion: Date.now(),
    ttl_ms: ttlMs
  };
  localStorage.setItem(key, JSON.stringify(cacheObj));
}

/**
 * Obtiene datos de la caché segura. Retorna null si no existe o expiró.
 * @param {string} key - Clave del localStorage
 */
export function getCacheSegura(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    const cacheObj = JSON.parse(raw);
    const { payload, creacion, ttl_ms } = cacheObj;

    if (creacion + ttl_ms > Date.now()) {
      return decryptData(payload);
    } else {
      // Expirado, limpiamos la clave
      localStorage.removeItem(key);
      return null;
    }
  } catch (error) {
    console.error("Cache corrupta o con formato inválido", error);
    localStorage.removeItem(key);
    return null;
  }
}

/**
 * Invalida/purga una clave específica en la caché.
 * @param {string} key - Clave a eliminar
 */
export function purgarCache(key) {
  localStorage.removeItem(key);
}

/**
 * Purga todas las claves relacionadas con los eventos en la caché.
 */
export function purgarCacheEventos() {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('cache_eventos_')) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}
