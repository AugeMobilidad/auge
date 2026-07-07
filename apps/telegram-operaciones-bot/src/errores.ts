/**
 * Los errores de negocio de Convex (transiciones inválidas, permisos, datos
 * faltantes) llegan como `Error` lanzados por las mutations. Nunca deben
 * llegar al chat como traza: se convierten a un mensaje amigable en español.
 */
import type { InlineKeyboard } from "gramio";
import { mensajeDeErrorConvex } from "./convex";

/**
 * Mínimo común entre `MessageContext` y `CallbackQueryContext` de GramIO
 * (ambos mezclan `SendMixin`). `reply_markup` se tipa como `InlineKeyboard`
 * (el builder de `@gramio/keyboards`): es lo único que el bot envía y su
 * `toJSON()` lo hace asignable al `reply_markup` real de Telegram sin
 * llamar `.build()`.
 */
export interface ParametrosEnvio {
  reply_markup?: InlineKeyboard;
}

export interface ContextoConEnvio {
  send(text: string, params?: ParametrosEnvio): Promise<unknown>;
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
