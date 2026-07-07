/**
 * Comandos ligeros de coordinador: /incidencias (globales) y /operacion
 * (estado corto). Solo responden si la cuenta vinculada es de
 * coordinador/operador/admin (`esCoordinador`, resuelto por Convex).
 */
import { api } from "../tipos";
import type { Id } from "../tipos";
import { convex } from "../convex";
import type { AugeBot } from "../bot";
import { requerirCuentaVinculada, telegramUserIdDe } from "../identidad";
import {
  lineaIncidencia,
  mensajeEstadoOperacion,
  mensajeFaltaOperacionId,
  mensajeOperacionNoEncontrada,
  mensajeSinIncidencias,
  mensajeSoloCoordinadores,
} from "../mensajes";
import { ejecutarConManejoDeErrores } from "../errores";
import { registrarUltimoComando } from "../telemetria";

export function registrarComandosCoordinador(bot: AugeBot): void {
  bot.command("incidencias", async (ctx) => {
    const telegramUserId = telegramUserIdDe(ctx);
    await ejecutarConManejoDeErrores(ctx, async () => {
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
      await ctx.send(incidencias.map(lineaIncidencia).join("\n\n"));
    });
    registrarUltimoComando(telegramUserId);
  });

  bot.command("operacion", async (ctx) => {
    const telegramUserId = telegramUserIdDe(ctx);
    await ejecutarConManejoDeErrores(ctx, async () => {
      const resultado = await requerirCuentaVinculada(telegramUserId);
      if (!resultado.ok) {
        await ctx.send(resultado.mensaje);
        return;
      }
      if (!resultado.cuenta.esCoordinador) {
        await ctx.send(mensajeSoloCoordinadores());
        return;
      }
      const operacionId = ctx.args?.trim();
      if (operacionId === undefined || operacionId.length === 0) {
        await ctx.send(mensajeFaltaOperacionId());
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
    });
    registrarUltimoComando(telegramUserId);
  });
}
