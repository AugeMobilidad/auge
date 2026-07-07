/**
 * /start — resuelve la identidad del remitente y responde según el estado
 * de su cuenta de Telegram (sin vincular, pendiente, vinculada, suspendida).
 */
import type { AugeBot } from "../bot";
import { resolverCuenta, telegramUserIdDe } from "../identidad";
import {
  mensajeBienvenidaSinVincular,
  mensajeBienvenidaVinculada,
  mensajeCuentaDesvinculada,
  mensajeCuentaSuspendida,
  mensajePendienteVerificacion,
} from "../mensajes";
import { ejecutarConManejoDeErrores } from "../errores";
import { registrarUltimoComando } from "../telemetria";

export function registrarComandosComunes(bot: AugeBot): void {
  bot.command("start", async (ctx) => {
    const telegramUserId = telegramUserIdDe(ctx);
    await ejecutarConManejoDeErrores(ctx, async () => {
      const cuenta = await resolverCuenta(telegramUserId);
      if (cuenta === null) {
        await ctx.send(mensajeBienvenidaSinVincular());
        return;
      }
      switch (cuenta.estado) {
        case "pendienteVerificacion":
          await ctx.send(mensajePendienteVerificacion());
          break;
        case "suspendida":
          await ctx.send(mensajeCuentaSuspendida());
          break;
        case "desvinculada":
          await ctx.send(mensajeCuentaDesvinculada());
          break;
        case "vinculada":
          await ctx.send(
            mensajeBienvenidaVinculada({
              nombre: cuenta.conductorNombre ?? cuenta.usuarioNombre ?? "usuario",
              esCoordinador: cuenta.esCoordinador,
              tipoUsuario: cuenta.tipoUsuario,
            }),
          );
          break;
        default:
          await ctx.send(mensajeBienvenidaSinVincular());
      }
    });
    registrarUltimoComando(telegramUserId);
  });
}
