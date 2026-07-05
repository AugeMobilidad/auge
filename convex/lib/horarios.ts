/**
 * Helpers de fechas/horarios compartidos por acciones y queries.
 * Convención: fechas de calendario "YYYY-MM-DD", horas "HH:mm", instantes
 * epoch ms. TODAS las fechas/horas de calendario del negocio se interpretan
 * en hora de Colombia (America/Bogota, UTC-5 fijo, sin horario de verano) —
 * nunca en la zona del servidor ni en UTC.
 */
import type { Doc } from "../_generated/dataModel";

/** Duración asumida de un servicio sin hora fin, para detectar solapes. */
export const DURACION_ASUMIDA_MIN = 120;

/** Offset fijo de Colombia respecto a UTC, en milisegundos. */
const OFFSET_BOGOTA_MS = -5 * 3600_000;

/** Fecha de calendario de HOY en hora de Colombia. */
export const hoyISO = () =>
  new Date(Date.now() + OFFSET_BOGOTA_MS).toISOString().slice(0, 10);

export function sumarDiasISO(fechaISO: string, dias: number): string {
  return new Date(new Date(`${fechaISO}T00:00:00Z`).getTime() + dias * 86400_000)
    .toISOString()
    .slice(0, 10);
}

export function aMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export function ventanaDeServicio(
  servicio: Pick<Doc<"serviciosTransporte">, "horaInicioProgramada" | "horaFinProgramada">,
): [number, number] {
  const inicio = aMinutos(servicio.horaInicioProgramada);
  const fin =
    servicio.horaFinProgramada !== undefined
      ? aMinutos(servicio.horaFinProgramada)
      : inicio + DURACION_ASUMIDA_MIN;
  return [inicio, fin];
}

export function ventanasSeSolapan(
  a: [number, number],
  b: [number, number],
): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

/** Instante programado de inicio del servicio en epoch ms (hora de Colombia). */
export function inicioProgramadoMs(
  servicio: Pick<Doc<"serviciosTransporte">, "fechaProgramada" | "horaInicioProgramada">,
): number {
  return new Date(
    `${servicio.fechaProgramada}T${servicio.horaInicioProgramada}:00-05:00`,
  ).getTime();
}
