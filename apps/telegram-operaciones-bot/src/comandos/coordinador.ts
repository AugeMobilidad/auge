/**
 * Comandos ligeros de coordinador: /incidencias (globales) y /operacion
 * (estado corto). Son atajos escritos de los botones del menú de /start: la
 * lógica (incluida la validación de rol) vive en `../acciones.ts`.
 */
import type { AugeBot } from "../bot";
import { telegramUserIdDe } from "../identidad";
import { mostrarEstadoOperacion, mostrarIncidenciasAbiertas } from "../acciones";
import { mensajeFaltaOperacionId } from "../mensajes";
import { ejecutarConManejoDeErrores } from "../errores";
import { registrarUltimoComando } from "../telemetria";

export function registrarComandosCoordinador(bot: AugeBot): void {
  bot.command("incidencias", { description: "Incidencias abiertas (coordinación)" }, async (ctx) => {
    const telegramUserId = telegramUserIdDe(ctx);
    await ejecutarConManejoDeErrores(ctx, () => mostrarIncidenciasAbiertas(ctx, telegramUserId));
    registrarUltimoComando(telegramUserId);
  });

  bot.command(
    "operacion",
    { description: "Estado corto de una operación (coordinación)" },
    async (ctx) => {
      const telegramUserId = telegramUserIdDe(ctx);
      await ejecutarConManejoDeErrores(ctx, async () => {
        const operacionId = ctx.args?.trim();
        if (operacionId === undefined || operacionId.length === 0) {
          await ctx.send(mensajeFaltaOperacionId());
          return;
        }
        await mostrarEstadoOperacion(ctx, telegramUserId, operacionId);
      });
      registrarUltimoComando(telegramUserId);
    },
  );
}
