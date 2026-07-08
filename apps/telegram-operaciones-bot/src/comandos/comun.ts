/**
 * /start — resuelve la identidad del remitente y responde según el estado
 * de su cuenta de Telegram (sin vincular, pendiente, vinculada, suspendida),
 * acompañando la respuesta con el menú de botones que corresponda: el menú
 * principal si está vinculada, o el botón «Vincular mi cuenta» si no.
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
import { tecladoMenuPrincipal, tecladoVincular } from "../teclados";
import { ejecutarConManejoDeErrores } from "../errores";
import { registrarUltimoComando } from "../telemetria";

export function registrarComandosComunes(bot: AugeBot): void {
  bot.command("start", { description: "Menú principal del bot" }, async (ctx) => {
    const telegramUserId = telegramUserIdDe(ctx);
    await ejecutarConManejoDeErrores(ctx, async () => {
      const cuenta = await resolverCuenta(telegramUserId);
      if (cuenta === null) {
        await ctx.send(mensajeBienvenidaSinVincular(), { reply_markup: tecladoVincular() });
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
          await ctx.send(mensajeCuentaDesvinculada(), { reply_markup: tecladoVincular() });
          break;
        case "vinculada":
          await ctx.send(
            mensajeBienvenidaVinculada({
              nombre: cuenta.conductorNombre ?? cuenta.usuarioNombre ?? "usuario",
              esCoordinador: cuenta.esCoordinador,
              tipoUsuario: cuenta.tipoUsuario,
            }),
            { reply_markup: tecladoMenuPrincipal(cuenta.esCoordinador) },
          );
          break;
        default:
          await ctx.send(mensajeBienvenidaSinVincular(), { reply_markup: tecladoVincular() });
      }
    });
    registrarUltimoComando(telegramUserId);
  });
}
