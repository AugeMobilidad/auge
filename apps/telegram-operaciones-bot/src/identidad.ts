/**
 * Resolución de identidad: SIEMPRE por `telegramUserId` (el id numérico de
 * Telegram del remitente, como string). El bot nunca pasa un `conductorId`
 * provisto por el cliente a una query/mutation de Convex — Convex resuelve
 * la cuenta vinculada a partir del `telegramUserId` y decide qué puede ver o
 * hacer cada quien. Esto es lo único que nos separa de que un chat
 * malicioso pueda operar servicios ajenos.
 */
import { api } from "./tipos";
import { convex } from "./convex";
import {
  mensajeBienvenidaSinVincular,
  mensajeCuentaDesvinculada,
  mensajeCuentaSuspendida,
  mensajePendienteVerificacion,
} from "./mensajes";

export type CuentaResuelta = Awaited<
  ReturnType<typeof convex.query<typeof api.appTelegram.telegramResolverCuenta>>
>;

export type CuentaVinculada = NonNullable<CuentaResuelta>;

export function telegramUserIdDe(ctx: { from?: { id: number } }): string {
  const id = ctx.from?.id;
  if (id === undefined) {
    throw new Error("No se pudo identificar al remitente del mensaje");
  }
  return String(id);
}

/**
 * `chatId` es `undefined` en `CallbackQueryContext` cuando el mensaje
 * original ya no es accesible para Telegram (muy antiguo). Es un caso de
 * borde raro; lo tratamos como error de negocio normal (mensaje amigable,
 * sin romper el bot).
 */
export function chatIdDe(ctx: { chatId?: number }): number {
  if (ctx.chatId === undefined) {
    throw new Error("No se pudo identificar el chat de este mensaje");
  }
  return ctx.chatId;
}

export async function resolverCuenta(telegramUserId: string): Promise<CuentaResuelta> {
  return await convex.query(api.appTelegram.telegramResolverCuenta, { telegramUserId });
}

export type ResultadoCuenta =
  | { ok: true; cuenta: CuentaVinculada }
  | { ok: false; mensaje: string };

/**
 * Resuelve la cuenta y traduce cualquier estado que no sea `vinculada` a un
 * mensaje amigable, para que cada comando no repita el mismo switch.
 */
export async function requerirCuentaVinculada(telegramUserId: string): Promise<ResultadoCuenta> {
  const cuenta = await resolverCuenta(telegramUserId);
  if (cuenta === null) return { ok: false, mensaje: mensajeBienvenidaSinVincular() };
  switch (cuenta.estado) {
    case "vinculada":
      return { ok: true, cuenta };
    case "pendienteVerificacion":
      return { ok: false, mensaje: mensajePendienteVerificacion() };
    case "suspendida":
      return { ok: false, mensaje: mensajeCuentaSuspendida() };
    case "desvinculada":
      return { ok: false, mensaje: mensajeCuentaDesvinculada() };
    default:
      return { ok: false, mensaje: mensajeBienvenidaSinVincular() };
  }
}
