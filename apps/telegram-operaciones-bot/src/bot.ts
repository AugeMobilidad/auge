/**
 * Instancia única del bot. Se construye acá (sin arrancar el polling) para
 * que cada módulo de `comandos/` y `callbacks/` pueda registrar sus
 * handlers con el tipo de contexto exacto inferido por GramIO, en vez de
 * anotarlo a mano.
 */
import { Bot } from "gramio";

const BOT_TOKEN = process.env.BOT_TOKEN;

if (BOT_TOKEN === undefined || BOT_TOKEN.trim() === "") {
  throw new Error("Falta la variable de entorno BOT_TOKEN (token del bot de Telegram)");
}

export const bot = new Bot(BOT_TOKEN);

/** Tipo del bot ya construido: lo usan los módulos de comandos/callbacks. */
export type AugeBot = typeof bot;
