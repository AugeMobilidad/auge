/** Utilidades de formato — Colombia / America/Bogota. */

const ZONA = "America/Bogota";

/** Fecha de negocio "YYYY-MM-DD" → "vie 03 jul" (sin corrimiento de zona). */
export function fmtFecha(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(d);
}

export function fmtFechaLarga(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Instante epoch-ms → "14:35" en hora de Colombia. */
export function fmtHoraTs(ms: number): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ms));
}

export function fmtFechaHoraTs(ms: number): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: ZONA,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ms));
}

export function fmtRelativo(ms: number): string {
  const delta = Date.now() - ms;
  const min = Math.round(delta / 60_000);
  if (Math.abs(min) < 1) return "ahora";
  if (Math.abs(min) < 60) return min > 0 ? `hace ${min} min` : `en ${-min} min`;
  const horas = Math.round(min / 60);
  if (Math.abs(horas) < 24) return horas > 0 ? `hace ${horas} h` : `en ${-horas} h`;
  const dias = Math.round(horas / 24);
  return dias > 0 ? `hace ${dias} d` : `en ${-dias} d`;
}

export function fmtCOP(n: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtNumero(n: number): string {
  return new Intl.NumberFormat("es-CO").format(n);
}

/** Fecha de negocio de hoy en Colombia (YYYY-MM-DD). */
export function hoyBogota(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return partes; // en-CA da directamente YYYY-MM-DD
}

/** Suma días a una fecha de negocio YYYY-MM-DD. */
export function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
