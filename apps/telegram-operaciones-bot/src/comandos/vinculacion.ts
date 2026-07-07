/**
 * /vincular y /desvincular — flujo de vinculación de cuenta de Telegram.
 *
 * El bot NUNCA envía `conductorId`/`usuarioSistemaId` a `vincularCuentaTelegram`:
 * solo registra teléfono/username, lo que dispara el estado
 * `pendienteVerificacion` en la mutation. Un coordinador completa la
 * vinculación (asociando el conductor/usuario correspondiente) por fuera del
 * bot. Ver nota en el reporte final sobre esta pieza del flujo.
 *
 * Antes de re-vincular comprobamos el estado actual: `vincularCuentaTelegram`
 * recalcula `estado` a partir únicamente de los argumentos recibidos (no del
 * estado existente), así que si volviéramos a llamarla sobre una cuenta ya
 * `vinculada` sin conductorId/usuarioSistemaId la dejaría en
 * `pendienteVerificacion`. Evitamos esa mutación por completo cuando la
 * cuenta ya está vinculada: pedimos primero /desvincular.
 */
import { api } from "../tipos";
import { convex } from "../convex";
import type { AugeBot } from "../bot";
import { resolverCuenta, telegramUserIdDe } from "../identidad";
import {
  mensajeDesvinculada,
  mensajeFaltaTelefono,
  mensajeSinCuentaParaDesvincular,
  mensajeSolicitudVinculacionRegistrada,
  mensajeYaVinculada,
} from "../mensajes";
import { ejecutarConManejoDeErrores } from "../errores";
import { registrarUltimoComando } from "../telemetria";

export function registrarComandosVinculacion(bot: AugeBot): void {
  bot.command("vincular", async (ctx) => {
    const telegramUserId = telegramUserIdDe(ctx);
    await ejecutarConManejoDeErrores(ctx, async () => {
      const telefono = ctx.args?.trim();
      if (telefono === undefined || telefono.length === 0) {
        await ctx.send(mensajeFaltaTelefono());
        return;
      }
      const cuenta = await resolverCuenta(telegramUserId);
      if (cuenta !== null && cuenta.estado === "vinculada") {
        await ctx.send(mensajeYaVinculada());
        return;
      }
      await convex.mutation(api.accionesOperativas.vincularCuentaTelegram, {
        telegramUserId,
        telegramChatId: String(ctx.chatId),
        username: ctx.from?.username,
        telefono,
      });
      await ctx.send(mensajeSolicitudVinculacionRegistrada());
    });
    registrarUltimoComando(telegramUserId);
  });

  bot.command("desvincular", async (ctx) => {
    const telegramUserId = telegramUserIdDe(ctx);
    await ejecutarConManejoDeErrores(ctx, async () => {
      const cuenta = await resolverCuenta(telegramUserId);
      if (cuenta === null) {
        await ctx.send(mensajeSinCuentaParaDesvincular());
        return;
      }
      await convex.mutation(api.accionesOperativas.desvincularCuentaTelegram, {
        telegramUserId,
      });
      await ctx.send(mensajeDesvinculada());
    });
    registrarUltimoComando(telegramUserId);
  });
}
