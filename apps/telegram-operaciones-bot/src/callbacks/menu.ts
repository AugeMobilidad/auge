/**
 * Botones del menú principal de /start (`menu:*` — convenciones en
 * `../teclados.ts`). Cada botón dispara la misma lógica que su comando
 * (`../acciones.ts`); «vincular» y «estado de operación» abren un asistente
 * que pide el dato faltante por texto (con ForceReply), en vez de exigir el
 * argumento escrito del comando.
 */
import { ForceReplyKeyboard } from "gramio";
import type { AugeBot } from "../bot";
import { chatIdDe, requerirCuentaVinculada, resolverCuenta, telegramUserIdDe } from "../identidad";
import { iniciarAsistente, limpiarAsistente } from "../estado/sesiones";
import {
  ejecutarDesvinculacion,
  mostrarIncidenciasAbiertas,
  mostrarMisServicios,
  mostrarServiciosParaIncidencia,
} from "../acciones";
import { tecladoConfirmarDesvincular } from "../teclados";
import {
  mensajeAccionCancelada,
  mensajeConfirmarDesvincular,
  mensajePideOperacionIdMenu,
  mensajePideTelefonoVinculacion,
  mensajeSoloCoordinadores,
  mensajeYaVinculada,
} from "../mensajes";
import { ejecutarConManejoDeErrores } from "../errores";
import { registrarUltimoComando } from "../telemetria";

export function registrarCallbacksMenu(bot: AugeBot): void {
  bot.callbackQuery(/^menu:servicios$/, async (ctx) => {
    await ctx.answer();
    const telegramUserId = telegramUserIdDe(ctx);
    await ejecutarConManejoDeErrores(ctx, () => mostrarMisServicios(ctx, telegramUserId));
    registrarUltimoComando(telegramUserId);
  });

  bot.callbackQuery(/^menu:incidencia$/, async (ctx) => {
    await ctx.answer();
    const telegramUserId = telegramUserIdDe(ctx);
    await ejecutarConManejoDeErrores(ctx, () => mostrarServiciosParaIncidencia(ctx, telegramUserId));
    registrarUltimoComando(telegramUserId);
  });

  bot.callbackQuery(/^menu:incidencias$/, async (ctx) => {
    await ctx.answer();
    const telegramUserId = telegramUserIdDe(ctx);
    await ejecutarConManejoDeErrores(ctx, () => mostrarIncidenciasAbiertas(ctx, telegramUserId));
    registrarUltimoComando(telegramUserId);
  });

  // --- Estado de operación: pide el id por texto ---
  bot.callbackQuery(/^menu:operacion$/, async (ctx) => {
    await ctx.answer();
    const telegramUserId = telegramUserIdDe(ctx);
    const chatId = chatIdDe(ctx);
    await ejecutarConManejoDeErrores(ctx, async () => {
      const resultado = await requerirCuentaVinculada(telegramUserId);
      if (!resultado.ok) {
        await ctx.send(resultado.mensaje);
        return;
      }
      if (!resultado.cuenta.esCoordinador) {
        await ctx.send(mensajeSoloCoordinadores());
        return;
      }
      iniciarAsistente(chatId, { tipo: "operacionId" });
      await ctx.send(mensajePideOperacionIdMenu(), {
        reply_markup: new ForceReplyKeyboard().placeholder("Id de la operación"),
      });
    });
    registrarUltimoComando(telegramUserId);
  });

  // --- Vincular: pide el teléfono por texto ---
  bot.callbackQuery(/^menu:vincular$/, async (ctx) => {
    await ctx.answer();
    const telegramUserId = telegramUserIdDe(ctx);
    const chatId = chatIdDe(ctx);
    await ejecutarConManejoDeErrores(ctx, async () => {
      const cuenta = await resolverCuenta(telegramUserId);
      if (cuenta !== null && cuenta.estado === "vinculada") {
        await ctx.send(mensajeYaVinculada());
        return;
      }
      iniciarAsistente(chatId, { tipo: "vincularTelefono" });
      await ctx.send(mensajePideTelefonoVinculacion(), {
        reply_markup: new ForceReplyKeyboard().placeholder("3001234567"),
      });
    });
  });

  // --- Desvincular: confirmación en dos pasos ---
  bot.callbackQuery(/^menu:desvincular$/, async (ctx) => {
    await ctx.answer();
    await ctx.send(mensajeConfirmarDesvincular(), {
      reply_markup: tecladoConfirmarDesvincular(),
    });
  });

  bot.callbackQuery(/^menu:desvincular:si$/, async (ctx) => {
    await ctx.answer();
    const telegramUserId = telegramUserIdDe(ctx);
    // Quita los botones de confirmación para que no se pueda re-tocar.
    // (`editText` tipa `text` como string plano: se pasan texto y entities
    // del FormattableString por separado.)
    const confirmacion = mensajeConfirmarDesvincular();
    await ctx
      .editText(confirmacion.text, { entities: confirmacion.entities })
      .catch(() => undefined);
    await ejecutarConManejoDeErrores(ctx, () => ejecutarDesvinculacion(ctx, telegramUserId));
    registrarUltimoComando(telegramUserId);
  });

  bot.callbackQuery(/^menu:cancelar$/, async (ctx) => {
    await ctx.answer();
    const chatId = chatIdDe(ctx);
    limpiarAsistente(chatId);
    await ctx.editText(mensajeAccionCancelada()).catch(() => undefined);
  });
}
