/**
 * Estado conversacional en memoria, por chat de Telegram.
 *
 * El bot no tiene base de datos propia: todo lo que importa vive en Convex.
 * Esto solo guarda, mientras dura el proceso, (a) el "servicio objetivo" al
 * que apuntan los próximos mensajes de ubicación/foto de un conductor y (b)
 * el paso en el que va un asistente de varios pasos (rechazo con motivo,
 * checklist, incidencia, cierre). Si el bot se reinicia se pierde, lo cual
 * es aceptable: el usuario simplemente vuelve a abrir el detalle del
 * servicio y retoma la acción.
 */
import type { FunctionArgs } from "convex/server";
import type { api, Id } from "../tipos";

type ArgsIncidencia = FunctionArgs<typeof api.accionesOperativas.conductorReportarIncidencia>;

export type AsistenteRechazo = {
  tipo: "rechazar";
  asignacionId: Id<"asignacionesServicio">;
  servicioId: Id<"serviciosTransporte">;
};

export type ValoresChecklist = {
  combustibleOk: boolean;
  llantasOk: boolean;
  lucesOk: boolean;
  documentosOk: boolean;
  limpiezaOk: boolean;
  gpsOk: boolean;
};

export type AsistenteChecklist = {
  tipo: "checklist";
  servicioId: Id<"serviciosTransporte">;
  valores: ValoresChecklist;
  /** true cuando se pidió observaciones y se espera la respuesta de texto. */
  esperandoObservaciones: boolean;
};

export type AsistenteIncidencia = {
  tipo: "incidencia";
  servicioId: Id<"serviciosTransporte">;
  paso: "tipo" | "severidad" | "descripcion";
  incidenciaTipo?: ArgsIncidencia["tipo"];
  severidad?: ArgsIncidencia["severidad"];
};

export type AsistenteCierre = {
  tipo: "cierre";
  servicioId: Id<"serviciosTransporte">;
  paso: "nota" | "pasajeros";
  notaCierre?: string;
};

/** Espera el teléfono tras tocar «Vincular mi cuenta» en el menú. */
export type AsistenteVincularTelefono = {
  tipo: "vincularTelefono";
};

/** Espera el id de operación tras tocar «Estado de operación» en el menú. */
export type AsistenteOperacionId = {
  tipo: "operacionId";
};

export type Asistente =
  | AsistenteRechazo
  | AsistenteChecklist
  | AsistenteIncidencia
  | AsistenteCierre
  | AsistenteVincularTelefono
  | AsistenteOperacionId;

export type SesionChat = {
  /** Servicio sobre el que aplican los próximos mensajes de ubicación/foto. */
  objetivoServicioId?: Id<"serviciosTransporte">;
  /** Asistente de varios pasos en curso (espera la próxima respuesta de texto/botón). */
  asistente?: Asistente;
};

const sesiones = new Map<number, SesionChat>();

export function obtenerSesion(chatId: number): SesionChat {
  let sesion = sesiones.get(chatId);
  if (sesion === undefined) {
    sesion = {};
    sesiones.set(chatId, sesion);
  }
  return sesion;
}

export function fijarObjetivo(chatId: number, servicioId: Id<"serviciosTransporte">): void {
  obtenerSesion(chatId).objetivoServicioId = servicioId;
}

export function iniciarAsistente(chatId: number, asistente: Asistente): void {
  obtenerSesion(chatId).asistente = asistente;
}

export function limpiarAsistente(chatId: number): void {
  obtenerSesion(chatId).asistente = undefined;
}
