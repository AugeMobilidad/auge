/**
 * Los errores de negocio de Convex (transiciones inválidas, permisos, datos
 * faltantes) llegan como `Error` lanzados por las mutations. Nunca deben
 * llegar al chat como traza: se convierten a un mensaje amigable en español.
 */
import type { ForceReplyKeyboard, InlineKeyboard, Stringable } from "gramio";
import { mensajeDeErrorConvex } from "./convex";

/**
 * Mínimo común entre `MessageContext` y `CallbackQueryContext` de GramIO
 * (ambos mezclan `SendMixin`). `reply_markup` se tipa con los builders de
 * `@gramio/keyboards` que el bot envía: su `toJSON()` los hace asignables al
 * `reply_markup` real de Telegram sin llamar `.build()`.
 *
 * `text` acepta `Stringable`: cubre tanto `string` como el
 * `FormattableString` que produce el template `format` de GramIO
 * (texto + entities), igual que el `send` real de los contextos.
 */
export interface ParametrosEnvio {
  reply_markup?: InlineKeyboard | ForceReplyKeyboard;
}

export interface ContextoConEnvio {
  send(text: Stringable, params?: ParametrosEnvio): Promise<unknown>;
}

export async function ejecutarConManejoDeErrores(
  ctx: ContextoConEnvio,
  accion: () => Promise<void>,
): Promise<void> {
  try {
    await accion();
  } catch (error) {
    console.error("[bot] error de negocio:", error);
    await ctx.send(mensajeDeErrorConvex(error));
  }
}
