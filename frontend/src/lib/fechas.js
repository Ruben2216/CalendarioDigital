// Utilidades de fecha compartidas por todo el panel (dashboard, calendario...)

export const ZONA = "America/Mexico_City";

export const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const ABREV_MES = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

/* Encabezados de los días (domingo primero). */
export const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function ahoraMexico() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: ZONA }));
}

export function aClaveFecha(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

export function desdeClaveFecha(clave) {
  const [anio, mes, dia] = clave.split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

export function sumarDias(fecha, dias) {
  const f = new Date(fecha);
  f.setDate(f.getDate() + dias);
  return f;
}

export function minutosDe(hora) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export function formatoHora(hora) {
  if (!hora) return "";
  const [h, m] = hora.split(":").map(Number);
  const periodo = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${periodo}`;
}

export function formatoHoraISO(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

export function tiempoRelativo(iso) {
  const fecha = new Date(iso);
  const seg = Math.floor((Date.now() - fecha.getTime()) / 1000);
  if (seg < 60) return "Hace un momento";
  const min = Math.floor(seg / 60);
  if (min < 60) return `Hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `Hace ${hrs} h`;
  const dias = Math.floor(hrs / 24);
  if (dias === 1) return "Ayer";
  if (dias < 7) return `Hace ${dias} días`;
  return fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export function formatoFechaLarga(clave) {
  const texto = new Intl.DateTimeFormat("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(desdeClaveFecha(clave));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function rangoSemana(ini, fin) {
  const mesIni = NOMBRES_MES[ini.getMonth()].toLowerCase();
  const mesFin = NOMBRES_MES[fin.getMonth()].toLowerCase();
  if (ini.getMonth() === fin.getMonth()) {
    return `${ini.getDate()} – ${fin.getDate()} de ${mesFin} de ${fin.getFullYear()}`;
  }
  return `${ini.getDate()} de ${mesIni} – ${fin.getDate()} de ${mesFin} de ${fin.getFullYear()}`;
}

/* Semestre A: agosto–enero · Semestre B: febrero–julio */
export function calcularSemestre(fecha) {
  const mes = fecha.getMonth();
  const anio = fecha.getFullYear();
  if (mes >= 7) return { letra: "A", ciclo: anio };
  if (mes === 0) return { letra: "A", ciclo: anio - 1 };
  return { letra: "B", ciclo: anio };
}
