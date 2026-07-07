/**
 * Puntos de finalización de los asistentes de varios pasos (rechazo,
 * checklist, incidencia, cierre). Los llaman tanto los handlers de botón
 * (`callbacks/servicio.ts`) como el handler de texto libre (`entradas.ts`),
 * según cuál sea el último paso que le falte al asistente.
 */
import type { FunctionArgs } from "convex/server";
import { api } from "./tipos";
import type { Id } from "./tipos";
import { convex } from "./convex";
import { limpiarAsistente } from "./estado/sesiones";
import type { ValoresChecklist } from "./estado/sesiones";
import {
  mensajeAsignacionRechazada,
  mensajeChecklistEnviado,
  mensajeIncidenciaRegistrada,
  mensajeServicioCerrado,
} from "./mensajes";
import { mostrarDetalleServicio } from "./vistas";
import type { ContextoConEnvio } from "./errores";

export async function finalizarRechazo(
  ctx: ContextoConEnvio,
  chatId: number,
  telegramUserId: string,
  asignacionId: Id<"asignacionesServicio">,
  motivo: string,
): Promise<void> {
  await convex.mutation(api.accionesOperativas.conductorRechazarAsignacion, {
    telegramUserId,
    asignacionId,
    motivo,
  });
  limpiarAsistente(chatId);
  await ctx.send(mensajeAsignacionRechazada());
}

export async function finalizarChecklist(
  ctx: ContextoConEnvio,
  chatId: number,
  telegramUserId: string,
  servicioId: Id<"serviciosTransporte">,
  valores: ValoresChecklist,
  observaciones: string | undefined,
): Promise<void> {
  await convex.mutation(api.accionesOperativas.conductorEnviarChecklist, {
    telegramUserId,
    servicioId,
    combustibleOk: valores.combustibleOk,
    llantasOk: valores.llantasOk,
    lucesOk: valores.lucesOk,
    documentosOk: valores.documentosOk,
    limpiezaOk: valores.limpiezaOk,
    gpsOk: valores.gpsOk,
    observaciones,
  });
  limpiarAsistente(chatId);
  await ctx.send(mensajeChecklistEnviado());
  await mostrarDetalleServicio(ctx, telegramUserId, servicioId);
}

type ArgsIncidencia = FunctionArgs<typeof api.accionesOperativas.conductorReportarIncidencia>;

export async function finalizarIncidencia(
  ctx: ContextoConEnvio,
  chatId: number,
  telegramUserId: string,
  servicioId: Id<"serviciosTransporte">,
  tipo: ArgsIncidencia["tipo"],
  severidad: ArgsIncidencia["severidad"],
  descripcion: string,
): Promise<void> {
  await convex.mutation(api.accionesOperativas.conductorReportarIncidencia, {
    telegramUserId,
    servicioId,
    tipo,
    severidad,
    descripcion,
  });
  limpiarAsistente(chatId);
  await ctx.send(mensajeIncidenciaRegistrada());
}

export async function finalizarCierre(
  ctx: ContextoConEnvio,
  chatId: number,
  telegramUserId: string,
  servicioId: Id<"serviciosTransporte">,
  notaCierre: string | undefined,
  cantidadPasajerosReal: number | undefined,
): Promise<void> {
  await convex.mutation(api.accionesOperativas.conductorCerrarServicio, {
    telegramUserId,
    servicioId,
    notaCierre,
    cantidadPasajerosReal,
    fuente: "telegram",
  });
  limpiarAsistente(chatId);
  await ctx.send(mensajeServicioCerrado());
}
