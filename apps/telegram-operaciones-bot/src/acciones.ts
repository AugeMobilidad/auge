/**
 * Acciones compartidas entre los comandos escritos (/misservicios, ...) y
 * los botones del menú de /start (`menu:*` en `callbacks/menu.ts`): la misma
 * lógica, dos puntos de entrada. Cada acción re-valida la cuenta (y el rol)
 * por su cuenta, porque un botón puede tocarse desde un teclado viejo cuya
 * cuenta cambió de estado desde que se envió.
 */
import { api } from "./tipos";
import type { Id } from "./tipos";
import { convex } from "./convex";
import { requerirCuentaVinculada, resolverCuenta } from "./identidad";
import { botonVerServicio } from "./teclados";
import {
  lineaServicioCorto,
  mensajeDesvinculada,
  mensajeEstadoOperacion,
  mensajeListaIncidencias,
  mensajeOperacionNoEncontrada,
  mensajeServiciosActivos,
  mensajeSinCuentaParaDesvincular,
  mensajeSinIncidencias,
  mensajeSinServicioEnCurso,
  mensajeSinServicios,
  mensajeSoloConductores,
  mensajeSoloCoordinadores,
} from "./mensajes";
import type { ContextoConEnvio } from "./errores";

export async function mostrarMisServicios(
  ctx: ContextoConEnvio,
  telegramUserId: string,
): Promise<void> {
  const resultado = await requerirCuentaVinculada(telegramUserId);
  if (!resultado.ok) {
    await ctx.send(resultado.mensaje);
    return;
  }
  if (resultado.cuenta.conductorId === undefined) {
    await ctx.send(mensajeSoloConductores());
    return;
  }
  const servicios = await convex.query(api.appTelegram.telegramServiciosDeConductor, {
    telegramUserId,
  });
  if (servicios.length === 0) {
    await ctx.send(mensajeSinServicios());
    return;
  }
  for (const servicio of servicios) {
    await ctx.send(lineaServicioCorto(servicio), {
      reply_markup: botonVerServicio(servicio.servicioId),
    });
  }
}

/** Lista los servicios en curso para elegir sobre cuál reportar la incidencia. */
export async function mostrarServiciosParaIncidencia(
  ctx: ContextoConEnvio,
  telegramUserId: string,
): Promise<void> {
  const resultado = await requerirCuentaVinculada(telegramUserId);
  if (!resultado.ok) {
    await ctx.send(resultado.mensaje);
    return;
  }
  if (resultado.cuenta.conductorId === undefined) {
    await ctx.send(mensajeSoloConductores());
    return;
  }
  const servicios = await convex.query(api.appTelegram.telegramServiciosDeConductor, {
    telegramUserId,
  });
  const activos = servicios.filter((s) => s.estadoServicio === "enCurso");
  if (activos.length === 0) {
    await ctx.send(mensajeSinServicioEnCurso());
    return;
  }
  await ctx.send(mensajeServiciosActivos());
  for (const servicio of activos) {
    await ctx.send(lineaServicioCorto(servicio), {
      reply_markup: botonVerServicio(servicio.servicioId),
    });
  }
}

export async function mostrarIncidenciasAbiertas(
  ctx: ContextoConEnvio,
  telegramUserId: string,
): Promise<void> {
  const resultado = await requerirCuentaVinculada(telegramUserId);
  if (!resultado.ok) {
    await ctx.send(resultado.mensaje);
    return;
  }
  if (!resultado.cuenta.esCoordinador) {
    await ctx.send(mensajeSoloCoordinadores());
    return;
  }
  const incidencias = await convex.query(api.appTelegram.telegramIncidenciasAbiertas, {
    telegramUserId,
  });
  if (incidencias.length === 0) {
    await ctx.send(mensajeSinIncidencias());
    return;
  }
  // `join` de GramIO (no Array.prototype.join): preserva los offsets de
  // las entities de formato de cada incidencia.
  await ctx.send(mensajeListaIncidencias(incidencias));
}

export async function mostrarEstadoOperacion(
  ctx: ContextoConEnvio,
  telegramUserId: string,
  operacionId: string,
): Promise<void> {
  const resultado = await requerirCuentaVinculada(telegramUserId);
  if (!resultado.ok) {
    await ctx.send(resultado.mensaje);
    return;
  }
  if (!resultado.cuenta.esCoordinador) {
    await ctx.send(mensajeSoloCoordinadores());
    return;
  }
  const estado = await convex.query(api.appTelegram.telegramEstadoOperacion, {
    telegramUserId,
    operacionId: operacionId as Id<"operaciones">,
  });
  if (estado === null) {
    await ctx.send(mensajeOperacionNoEncontrada());
    return;
  }
  await ctx.send(mensajeEstadoOperacion(estado));
}

export async function ejecutarDesvinculacion(
  ctx: ContextoConEnvio,
  telegramUserId: string,
): Promise<void> {
  const cuenta = await resolverCuenta(telegramUserId);
  if (cuenta === null) {
    await ctx.send(mensajeSinCuentaParaDesvincular());
    return;
  }
  await convex.mutation(api.accionesOperativas.desvincularCuentaTelegram, {
    telegramUserId,
  });
  await ctx.send(mensajeDesvinculada());
}
