// Notificaciones y anuncios de ejemplo
import {
  Pencil, Plus, Users, AlertTriangle, FileText, Calendar, GraduationCap,
} from "lucide-react";

export const NOTIFICACIONES = [
  { id: 1, icono: Pencil, color: "azul", titulo: "Examen parcial de Matemáticas actualizado al 10 jun", subtitulo: "Hace 2 horas · Prof. García", sinLeer: true },
  { id: 2, icono: Plus, color: "verde", titulo: "Nuevo evento: Torneo deportivo interplantel", subtitulo: "Hace 5 horas · Administración", sinLeer: true },
  { id: 3, icono: Users, color: "gris", titulo: "3 nuevos usuarios registrados", subtitulo: "Ayer · Sistema", sinLeer: true },
  { id: 4, icono: AlertTriangle, color: "naranja", titulo: "Recordatorio: entrega de calificaciones el 12 jun", subtitulo: "Hace 2 días · Dirección", sinLeer: false },
  { id: 5, icono: FileText, color: "azul", titulo: "Calendario de junio exportado por 12 usuarios", subtitulo: "Hace 3 días", sinLeer: false },
];

export const ANUNCIOS = [
  { id: 1, icono: Calendar, color: "azul", titulo: "Nuevo calendario escolar 2026 A", descripcion: "Consulta las fechas importantes del próximo ciclo escolar.", fecha: "15 MAY" },
  { id: 2, icono: GraduationCap, color: "verde", titulo: "Convocatoria de becas institucionales", descripcion: "Abierta del 12 al 30 de mayo de 2026.", fecha: "14 MAY" },
  { id: 3, icono: AlertTriangle, color: "naranja", titulo: "Mantenimiento en plataforma", descripcion: "El sábado 17 de mayo de 8:00 a.m. a 12:00 p.m.", fecha: "13 MAY" },
  { id: 4, icono: FileText, color: "morado", titulo: "Actualización de documentos", descripcion: "Revisa los nuevos formatos en Gestión Documental.", fecha: "12 MAY" },
];
