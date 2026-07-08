/**
 * Handlers de los botones inline del detalle de servicio. Convenciones de
 * `callback_data` documentadas en `../teclados.ts`.
 *
 * Cada handler responde el callback (`ctx.answer()`) de entrada para que
 * Telegram apague el spinner del botón, y delega el trabajo de negocio en
 * `flujos.ts` cuando se trata del último paso de un asistente.
 */
import { ForceReplyKeyboard } from "gramio";
import { api } from "../tipos";
import type { Id } from "../tipos";
import { convex } from "../convex";
import type { AugeBot } from "../bot";
import { chatIdDe, telegramUserIdDe } from "../identidad";
import { fijarObjetivo, iniciarAsistente, obtenerSesion } from "../estado/sesiones";
import {
  campoChecklistDesdeCallback,
  tecladoChecklist,
  tecladoNotaCierre,
  tecladoObservacionesChecklist,
  tecladoPasajerosCierre,
  tecladoSeveridadIncidencia,
  tecladoTipoIncidencia,
} from "../teclados";
import {
  mensajeAsignacionConfirmada,
  mensajePideCantidadPasajeros,
  mensajePideDescripcionIncidencia,
  mensajePideEvidencia,
  mensajePideMotivoRechazo,
  mensajePideNotaCierre,
  mensajePideObservacionesChecklist,
  mensajePideSeveridadIncidencia,
  mensajePideTipoIncidencia,
  mensajePideUbicacion,
  mensajeChecklistIntro,
  mensajeServicioIniciado,
  mensajeServicioNoEncontrado,
} from "../mensajes";
import { ejecutarConManejoDeErrores } from "../errores";
import { mostrarDetalleServicio, resolverServicioIdDeAsignacion } from "../vistas";
import { finalizarChecklist, finalizarCierre } from "../flujos";
import { grupoCapturado } from "../util";

export function registrarCallbacksServicio(bot: AugeBot): void {
  // --- Ver detalle ---
  bot.callbackQuery(/^sv:(.+)$/, async (ctx) => {
    await ctx.answer();
    const telegramUserId = telegramUserIdDe(ctx);
    const servicioId = grupoCapturado(ctx.queryData, 1) as Id<"serviciosTransporte">;
    await ejecutarConManejoDeErrores(ctx, async () => {
      await mostrarDetalleServicio(ctx, telegramUserId, servicioId);
    });
  });

  // --- Confirmar asignación ---
  bot.callbackQuery(/^cf:(.+)$/, async (ctx) => {
    await ctx.answer();
    const telegramUserId = telegramUserIdDe(ctx);
    const asignacionId = grupoCapturado(ctx.queryData, 1) as Id<"asignacionesServicio">;
    await ejecutarConManejoDeErrores(ctx, async () => {
      await convex.mutation(api.accionesOperativas.conductorConfirmarAsignacion, {
        telegramUserId,
        asignacionId,
      });
      await ctx.send(mensajeAsignacionConfirmada());
      const servicioId = await resolverServicioIdDeAsignacion(telegramUserId, asignacionId);
      if (servicioId !== null) await mostrarDetalleServicio(ctx, telegramUserId, servicioId);
    });
  });

  // --- Rechazar asignación (pide motivo por texto) ---
  bot.callbackQuery(/^rc:(.+)$/, async (ctx) => {
    await ctx.answer();
    const telegramUserId = telegramUserIdDe(ctx);
    const chatId = chatIdDe(ctx);
    const asignacionId = grupoCapturado(ctx.queryData, 1) as Id<"asignacionesServicio">;
    await ejecutarConManejoDeErrores(ctx, async () => {
      const servicioId = await resolverServicioIdDeAsignacion(telegramUserId, asignacionId);
      if (servicioId === null) {
        await ctx.send(mensajeServicioNoEncontrado());
        return;
      }
      iniciarAsistente(chatId, { tipo: "rechazar", asignacionId, servicioId });
      await ctx.send(mensajePideMotivoRechazo(), {
        reply_markup: new ForceReplyKeyboard().placeholder("Motivo del rechazo"),
      });
    });
  });

  // --- Checklist preoperativo ---
  bot.callbackQuery(/^ck:([^:]+)$/, async (ctx) => {
    await ctx.answer();
    const chatId = chatIdDe(ctx);
    const servicioId = grupoCapturado(ctx.queryData, 1) as Id<"serviciosTransporte">;
    const valores = {
      combustibleOk: false,
      llantasOk: false,
      lucesOk: false,
      documentosOk: false,
      limpiezaOk: false,
      gpsOk: false,
    };
    iniciarAsistente(chatId, {
      tipo: "checklist",
      servicioId,
      valores,
      esperandoObservaciones: false,
    });
    await ctx.send(mensajeChecklistIntro(), { reply_markup: tecladoChecklist(valores) });
  });

  bot.callbackQuery(/^ck:t:([a-zA-Z]+)$/, async (ctx) => {
    await ctx.answer();
    const chatId = chatIdDe(ctx);
    const campo = campoChecklistDesdeCallback(grupoCapturado(ctx.queryData, 1));
    const sesion = obtenerSesion(chatId);
    if (campo === null || sesion.asistente?.tipo !== "checklist") return;
    sesion.asistente.valores[campo] = !sesion.asistente.valores[campo];
    await ctx.editReplyMarkup(tecladoChecklist(sesion.asistente.valores));
  });

  bot.callbackQuery(/^ck:enviar$/, async (ctx) => {
    await ctx.answer();
    const chatId = chatIdDe(ctx);
    const sesion = obtenerSesion(chatId);
    if (sesion.asistente?.tipo !== "checklist") return;
    sesion.asistente.esperandoObservaciones = true;
    await ctx.send(mensajePideObservacionesChecklist(), {
      reply_markup: tecladoObservacionesChecklist(),
    });
  });

  bot.callbackQuery(/^ck:obs:no$/, async (ctx) => {
    await ctx.answer();
    const telegramUserId = telegramUserIdDe(ctx);
    const chatId = chatIdDe(ctx);
    await ejecutarConManejoDeErrores(ctx, async () => {
      const sesion = obtenerSesion(chatId);
      if (sesion.asistente?.tipo !== "checklist") return;
      const { servicioId, valores } = sesion.asistente;
      await finalizarChecklist(ctx, chatId, telegramUserId, servicioId, valores, undefined);
    });
  });

  // --- Iniciar servicio ---
  bot.callbackQuery(/^in:(.+)$/, async (ctx) => {
    await ctx.answer();
    const telegramUserId = telegramUserIdDe(ctx);
    const chatId = chatIdDe(ctx);
    const servicioId = grupoCapturado(ctx.queryData, 1) as Id<"serviciosTransporte">;
    await ejecutarConManejoDeErrores(ctx, async () => {
      await convex.mutation(api.accionesOperativas.conductorIniciarServicio, {
        telegramUserId,
        servicioId,
        fuente: "telegram",
      });
      fijarObjetivo(chatId, servicioId);
      await ctx.send(mensajeServicioIniciado());
      await mostrarDetalleServicio(ctx, telegramUserId, servicioId);
    });
  });

  // --- Fijar objetivo para ubicación / evidencia ---
  bot.callbackQuery(/^ub:(.+)$/, async (ctx) => {
    await ctx.answer();
    const chatId = chatIdDe(ctx);
    const servicioId = grupoCapturado(ctx.queryData, 1) as Id<"serviciosTransporte">;
    fijarObjetivo(chatId, servicioId);
    await ctx.send(mensajePideUbicacion());
  });

  bot.callbackQuery(/^ev:(.+)$/, async (ctx) => {
    await ctx.answer();
    const chatId = chatIdDe(ctx);
    const servicioId = grupoCapturado(ctx.queryData, 1) as Id<"serviciosTransporte">;
    fijarObjetivo(chatId, servicioId);
    await ctx.send(mensajePideEvidencia());
  });

  // --- Incidencia ---
  bot.callbackQuery(/^ic:([^:]+)$/, async (ctx) => {
    await ctx.answer();
    const chatId = chatIdDe(ctx);
    const servicioId = grupoCapturado(ctx.queryData, 1) as Id<"serviciosTransporte">;
    iniciarAsistente(chatId, { tipo: "incidencia", servicioId, paso: "tipo" });
    await ctx.send(mensajePideTipoIncidencia(), { reply_markup: tecladoTipoIncidencia() });
  });

  bot.callbackQuery(
    /^ic:t:(retraso|noShow|fallaVehiculo|cambioRuta|accidente|queja|contingencia|otro)$/,
    async (ctx) => {
      await ctx.answer();
      const chatId = chatIdDe(ctx);
      const sesion = obtenerSesion(chatId);
      const asistente = sesion.asistente;
      if (asistente?.tipo !== "incidencia") return;
      asistente.incidenciaTipo = grupoCapturado(
        ctx.queryData,
        1,
      ) as typeof asistente.incidenciaTipo;
      asistente.paso = "severidad";
      await ctx.send(mensajePideSeveridadIncidencia(), {
        reply_markup: tecladoSeveridadIncidencia(),
      });
    },
  );

  bot.callbackQuery(/^ic:s:(baja|media|alta|critica)$/, async (ctx) => {
    await ctx.answer();
    const chatId = chatIdDe(ctx);
    const sesion = obtenerSesion(chatId);
    const asistente = sesion.asistente;
    if (asistente?.tipo !== "incidencia") return;
    asistente.severidad = grupoCapturado(
      ctx.queryData,
      1,
    ) as typeof asistente.severidad;
    asistente.paso = "descripcion";
    await ctx.send(mensajePideDescripcionIncidencia(), {
      reply_markup: new ForceReplyKeyboard().placeholder("¿Qué pasó?"),
    });
  });

  // --- Cierre de servicio ---
  bot.callbackQuery(/^ce:([^:]+)$/, async (ctx) => {
    await ctx.answer();
    const chatId = chatIdDe(ctx);
    const servicioId = grupoCapturado(ctx.queryData, 1) as Id<"serviciosTransporte">;
    iniciarAsistente(chatId, { tipo: "cierre", servicioId, paso: "nota" });
    await ctx.send(mensajePideNotaCierre(), { reply_markup: tecladoNotaCierre() });
  });

  bot.callbackQuery(/^ce:nota:no$/, async (ctx) => {
    await ctx.answer();
    const chatId = chatIdDe(ctx);
    const sesion = obtenerSesion(chatId);
    if (sesion.asistente?.tipo !== "cierre") return;
    sesion.asistente.paso = "pasajeros";
    await ctx.send(mensajePideCantidadPasajeros(), { reply_markup: tecladoPasajerosCierre() });
  });

  bot.callbackQuery(/^ce:pas:no$/, async (ctx) => {
    await ctx.answer();
    const telegramUserId = telegramUserIdDe(ctx);
    const chatId = chatIdDe(ctx);
    await ejecutarConManejoDeErrores(ctx, async () => {
      const sesion = obtenerSesion(chatId);
      if (sesion.asistente?.tipo !== "cierre") return;
      const { servicioId, notaCierre } = sesion.asistente;
      await finalizarCierre(ctx, chatId, telegramUserId, servicioId, notaCierre, undefined);
    });
  });
}
