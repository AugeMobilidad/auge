/**
 * Vistas reutilizables (mensaje + teclado) que se muestran desde más de un
 * lugar: al abrir el detalle de un servicio desde /misservicios y al
 * refrescarlo después de ejecutar una acción sobre ese mismo servicio.
 *
 * Nota Convex: `telegramDetalleServicio` no expone `asignacionId` (solo
 * `servicioId` + `estadoAsignacion`), pero los botones "Confirmar"/
 * "Rechazar" necesitan justamente ese id. Lo resolvemos cruzando con
 * `telegramServiciosDeConductor` (que sí trae `asignacionId`) en vez de
 * tocar `convex/appTelegram.ts` (fuera de los límites de este cambio). Si no
 * aparece ahí (por ejemplo, ya no está en estado propuesta/confirmada),
 * simplemente no se muestran esos dos botones.
 */
import { api } from "./tipos";
import type { Id } from "./tipos";
import { convex } from "./convex";
import { mensajeDetalleServicio, mensajeServicioNoEncontrado } from "./mensajes";
import { tecladoAccionesServicio } from "./teclados";
import type { ContextoConEnvio } from "./errores";

async function resolverAsignacionId(
  telegramUserId: string,
  servicioId: Id<"serviciosTransporte">,
): Promise<Id<"asignacionesServicio"> | null> {
  const propios = await convex.query(api.appTelegram.telegramServiciosDeConductor, {
    telegramUserId,
  });
  return propios.find((s) => s.servicioId === servicioId)?.asignacionId ?? null;
}

/** El inverso de `resolverAsignacionId`: usado por los botones "Confirmar"/"Rechazar", que solo traen `asignacionId` en el `callback_data`. */
export async function resolverServicioIdDeAsignacion(
  telegramUserId: string,
  asignacionId: Id<"asignacionesServicio">,
): Promise<Id<"serviciosTransporte"> | null> {
  const propios = await convex.query(api.appTelegram.telegramServiciosDeConductor, {
    telegramUserId,
  });
  return propios.find((s) => s.asignacionId === asignacionId)?.servicioId ?? null;
}

export async function mostrarDetalleServicio(
  ctx: ContextoConEnvio,
  telegramUserId: string,
  servicioId: Id<"serviciosTransporte">,
): Promise<void> {
  const detalle = await convex.query(api.appTelegram.telegramDetalleServicio, {
    telegramUserId,
    servicioId,
  });
  if (detalle === null) {
    await ctx.send(mensajeServicioNoEncontrado());
    return;
  }
  const necesitaAsignacionId =
    detalle.accionesPermitidas.includes("confirmarAsignacion") ||
    detalle.accionesPermitidas.includes("rechazarAsignacion");
  const asignacionId = necesitaAsignacionId
    ? await resolverAsignacionId(telegramUserId, servicioId)
    : null;
  const kb = tecladoAccionesServicio(detalle.servicioId, asignacionId, detalle.accionesPermitidas);
  await ctx.send(mensajeDetalleServicio(detalle), kb !== undefined ? { reply_markup: kb } : undefined);
}
