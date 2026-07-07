/**
 * Entradas "crudas" del chat que no son comandos ni taps de botón:
 *  - mensajes de ubicación de Telegram → `conductorReportarUbicacion`
 *  - fotos → `conductorRegistrarEvidencia` (usando el `file_id` de Telegram
 *    como referencia, tal como pide el encargo)
 *  - texto libre → el siguiente paso del asistente activo (rechazo,
 *    checklist, incidencia, cierre), si hay uno en curso
 */
import { api } from "./tipos";
import type { Id } from "./tipos";
import { convex } from "./convex";
import type { AugeBot } from "./bot";
import { telegramUserIdDe } from "./identidad";
import { obtenerSesion, fijarObjetivo } from "./estado/sesiones";
import {
  mensajeEvidenciaRegistrada,
  mensajeNumeroInvalido,
  mensajePideCantidadPasajeros,
  mensajePideDescripcionIncidencia,
  mensajePideMotivoRechazo,
  mensajeSinServicioEnCurso,
  mensajeUbicacionRegistrada,
} from "./mensajes";
import { tecladoPasajerosCierre } from "./teclados";
import { ejecutarConManejoDeErrores } from "./errores";
import { finalizarCierre, finalizarChecklist, finalizarIncidencia, finalizarRechazo } from "./flujos";

/**
 * Resuelve a qué servicio apuntan los próximos reportes de ubicación/
 * evidencia: el "objetivo" fijado por un botón, o -si no hay uno- el único
 * servicio en curso del conductor. Si hay cero o más de uno, pide que abra
 * el detalle del servicio y toque el botón correspondiente primero.
 */
async function resolverServicioObjetivo(
  telegramUserId: string,
  chatId: number,
): Promise<Id<"serviciosTransporte"> | null> {
  const sesion = obtenerSesion(chatId);
  if (sesion.objetivoServicioId !== undefined) return sesion.objetivoServicioId;
  const servicios = await convex.query(api.appTelegram.telegramServiciosDeConductor, {
    telegramUserId,
  });
  const enCurso = servicios.filter((s) => s.estadoServicio === "enCurso");
  if (enCurso.length === 1 && enCurso[0] !== undefined) {
    fijarObjetivo(chatId, enCurso[0].servicioId);
    return enCurso[0].servicioId;
  }
  return null;
}

export function registrarEntradas(bot: AugeBot): void {
  bot.on(
    "message",
    (ctx) => ctx.location !== undefined,
    async (ctx) => {
      const telegramUserId = telegramUserIdDe(ctx);
      const chatId = ctx.chatId;
      await ejecutarConManejoDeErrores(ctx, async () => {
        const servicioId = await resolverServicioObjetivo(telegramUserId, chatId);
        if (servicioId === null) {
          await ctx.send(mensajeSinServicioEnCurso());
          return;
        }
        const { latitude, longitude } = ctx.location!;
        await convex.mutation(api.accionesOperativas.conductorReportarUbicacion, {
          telegramUserId,
          servicioId,
          lat: latitude,
          lng: longitude,
          fuente: "telegram",
          evento: "ubicacion",
        });
        await ctx.send(mensajeUbicacionRegistrada());
      });
    },
  );

  bot.on(
    "message",
    (ctx) => ctx.photo !== undefined,
    async (ctx) => {
      const telegramUserId = telegramUserIdDe(ctx);
      const chatId = ctx.chatId;
      await ejecutarConManejoDeErrores(ctx, async () => {
        const servicioId = await resolverServicioObjetivo(telegramUserId, chatId);
        if (servicioId === null) {
          await ctx.send(mensajeSinServicioEnCurso());
          return;
        }
        const fotos = ctx.photo ?? [];
        const masGrande = fotos[fotos.length - 1];
        if (masGrande === undefined) return;
        await convex.mutation(api.accionesOperativas.conductorRegistrarEvidencia, {
          telegramUserId,
          servicioId,
          tipo: "foto",
          descripcion: ctx.caption ?? "Foto enviada por Telegram",
          archivoUrl: masGrande.fileId,
        });
        await ctx.send(mensajeEvidenciaRegistrada());
      });
    },
  );

  bot.on(
    "message",
    (ctx) => ctx.text !== undefined && !ctx.text.startsWith("/"),
    async (ctx) => {
      const telegramUserId = telegramUserIdDe(ctx);
      const chatId = ctx.chatId;
      const texto = (ctx.text ?? "").trim();
      const sesion = obtenerSesion(chatId);
      const asistente = sesion.asistente;
      if (asistente === undefined) return;

      await ejecutarConManejoDeErrores(ctx, async () => {
        switch (asistente.tipo) {
          case "rechazar": {
            if (texto.length === 0) {
              await ctx.send(mensajePideMotivoRechazo());
              return;
            }
            await finalizarRechazo(ctx, chatId, telegramUserId, asistente.asignacionId, texto);
            return;
          }
          case "checklist": {
            if (!asistente.esperandoObservaciones) return;
            await finalizarChecklist(
              ctx,
              chatId,
              telegramUserId,
              asistente.servicioId,
              asistente.valores,
              texto.length > 0 ? texto : undefined,
            );
            return;
          }
          case "incidencia": {
            if (asistente.paso !== "descripcion") return;
            if (asistente.incidenciaTipo === undefined || asistente.severidad === undefined) {
              await ctx.send(mensajePideDescripcionIncidencia());
              return;
            }
            if (texto.length === 0) {
              await ctx.send(mensajePideDescripcionIncidencia());
              return;
            }
            await finalizarIncidencia(
              ctx,
              chatId,
              telegramUserId,
              asistente.servicioId,
              asistente.incidenciaTipo,
              asistente.severidad,
              texto,
            );
            return;
          }
          case "cierre": {
            if (asistente.paso === "nota") {
              asistente.notaCierre = texto.length > 0 ? texto : undefined;
              asistente.paso = "pasajeros";
              await ctx.send(mensajePideCantidadPasajeros(), {
                reply_markup: tecladoPasajerosCierre(),
              });
              return;
            }
            if (asistente.paso === "pasajeros") {
              const cantidad = Number(texto);
              if (!Number.isFinite(cantidad) || cantidad < 0) {
                await ctx.send(mensajeNumeroInvalido());
                return;
              }
              await finalizarCierre(
                ctx,
                chatId,
                telegramUserId,
                asistente.servicioId,
                asistente.notaCierre,
                cantidad,
              );
            }
            return;
          }
          default:
            return;
        }
      });
    },
  );
}
