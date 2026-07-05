/**
 * Helpers de fechas/horarios compartidos por acciones y queries.
 * Convención: fechas de calendario "YYYY-MM-DD", horas "HH:mm", instantes epoch ms.
 */
import type { Doc } from "../_generated/dataModel";

/** Duración asumida de un servicio sin hora fin, para detectar solapes. */
export const DURACION_ASUMIDA_MIN = 120;

export const hoyISO = () => new Date().toISOString().slice(0, 10);

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

/** Instante programado de inicio del servicio en epoch ms (interpretado UTC). */
export function inicioProgramadoMs(
  servicio: Pick<Doc<"serviciosTransporte">, "fechaProgramada" | "horaInicioProgramada">,
): number {
  return new Date(
    `${servicio.fechaProgramada}T${servicio.horaInicioProgramada}:00Z`,
  ).getTime();
}
