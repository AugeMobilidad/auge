/**
 * Comandos de conductor: /misservicios y /incidencia (entrada por comando;
 * el flujo completo de reportar la incidencia vive en
 * `callbacks/servicio.ts`, disparado desde el botón del detalle).
 */
import { api } from "../tipos";
import { convex } from "../convex";
import type { AugeBot } from "../bot";
import { requerirCuentaVinculada, telegramUserIdDe } from "../identidad";
import { botonVerServicio } from "../teclados";
import {
  lineaServicioCorto,
  mensajeServiciosActivos,
  mensajeSinServicioEnCurso,
  mensajeSinServicios,
  mensajeSoloConductores,
} from "../mensajes";
import { ejecutarConManejoDeErrores } from "../errores";
import { registrarUltimoComando } from "../telemetria";

export function registrarComandosConductor(bot: AugeBot): void {
  bot.command("misservicios", async (ctx) => {
    const telegramUserId = telegramUserIdDe(ctx);
    await ejecutarConManejoDeErrores(ctx, async () => {
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
    });
    registrarUltimoComando(telegramUserId);
  });

  bot.command("incidencia", async (ctx) => {
    const telegramUserId = telegramUserIdDe(ctx);
    await ejecutarConManejoDeErrores(ctx, async () => {
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
    });
    registrarUltimoComando(telegramUserId);
  });
}

