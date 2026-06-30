import { aClaveFecha } from "./fechas.js";

export const RANGOS_PROXIMOS = [
  { id: "semana", etiqueta: "1 semana", dias: 7 },
  { id: "quincena", etiqueta: "15 días", dias: 15 },
  { id: "mes", etiqueta: "1 mes", dias: 30 },
];

export function limiteRango(hoy, rangoId) {
  const dias = RANGOS_PROXIMOS.find((r) => r.id === rangoId)?.dias ?? 7;
  return aClaveFecha(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + dias));
}
