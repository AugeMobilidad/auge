/**
 * Comandos de conductor: /misservicios y /incidencia. Son atajos escritos de
 * los botones del menú de /start: la lógica vive en `../acciones.ts` y el
 * flujo completo de reportar la incidencia en `callbacks/servicio.ts`,
 * disparado desde el botón del detalle.
 */
import type { AugeBot } from "../bot";
import { telegramUserIdDe } from "../identidad";
import { mostrarMisServicios, mostrarServiciosParaIncidencia } from "../acciones";
import { ejecutarConManejoDeErrores } from "../errores";
import { registrarUltimoComando } from "../telemetria";

export function registrarComandosConductor(bot: AugeBot): void {
  bot.command("misservicios", { description: "Tus servicios de hoy y próximos" }, async (ctx) => {
    const telegramUserId = telegramUserIdDe(ctx);
    await ejecutarConManejoDeErrores(ctx, () => mostrarMisServicios(ctx, telegramUserId));
    registrarUltimoComando(telegramUserId);
  });

  bot.command(
    "incidencia",
    { description: "Reportar una incidencia de un servicio en curso" },
    async (ctx) => {
      const telegramUserId = telegramUserIdDe(ctx);
      await ejecutarConManejoDeErrores(ctx, () => mostrarServiciosParaIncidencia(ctx, telegramUserId));
      registrarUltimoComando(telegramUserId);
    },
  );
}
