/**
 * Telemetría mínima: marca el instante del último comando recibido por cada
 * cuenta de Telegram. Es fire-and-forget a propósito (nunca debe bloquear ni
 * romper la respuesta al usuario): si la cuenta todavía no existe (por
 * ejemplo, antes del primer /vincular) la mutation lanza y simplemente lo
 * registramos en consola.
 */
import { api } from "./tipos";
import { convex } from "./convex";

export function registrarUltimoComando(telegramUserId: string): void {
  void convex
    .mutation(api.accionesOperativas.actualizarUltimoComandoTelegram, { telegramUserId })
    .catch((error: unknown) => {
      console.error("[bot] no se pudo actualizar ultimoComandoEn:", error);
    });
}
