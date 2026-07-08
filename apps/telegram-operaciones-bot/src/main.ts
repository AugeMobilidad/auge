/**
 * Punto de entrada del bot de Telegram de Auge Movilidad.
 *
 * Arranca por long-polling (cómodo para desarrollo: no necesita URL pública
 * ni certificados). El token (`BOT_TOKEN`) y la URL de Convex (`CONVEX_URL`)
 * vienen siempre del entorno — ver `bot.ts` / `convex.ts`.
 *
 * Orden de registro (importa): comandos primero, luego los botones inline
 * (evento `callback_query`, no compite con lo anterior) y por último los
 * handlers de contenido crudo (ubicación/foto/texto libre), que ignoran
 * cualquier mensaje que ya haya sido consumido por un comando.
 */
import { bot } from "./bot";
import { registrarComandosComunes } from "./comandos/comun";
import { registrarComandosVinculacion } from "./comandos/vinculacion";
import { registrarComandosConductor } from "./comandos/conductor";
import { registrarComandosCoordinador } from "./comandos/coordinador";
import { registrarCallbacksServicio } from "./callbacks/servicio";
import { registrarCallbacksMenu } from "./callbacks/menu";
import { registrarEntradas } from "./entradas";
import { mensajeErrorGenerico } from "./mensajes";

registrarComandosComunes(bot);
registrarComandosVinculacion(bot);
registrarComandosConductor(bot);
registrarComandosCoordinador(bot);
registrarCallbacksServicio(bot);
registrarCallbacksMenu(bot);
registrarEntradas(bot);

// Red de seguridad: cualquier error no capturado por los handlers (bugs,
// fallas de red hacia Convex, etc.) termina en un mensaje amigable al chat
// en vez de una traza cruda, y siempre queda registrado en consola.
bot.onError(({ context, kind, error }) => {
  console.error(`[bot] error no manejado (${kind}):`, error);
  if (context.is("message")) {
    return context.send(mensajeErrorGenerico());
  }
  if (context.is("callback_query")) {
    return context.answer({ text: mensajeErrorGenerico(), show_alert: true });
  }
  return undefined;
});

bot.onStart(async ({ info }) => {
  console.log(`[bot] conectado como @${info.username} (long-polling)`);
  // Publica el menú de comandos de Telegram a partir de las descripciones
  // registradas en cada `bot.command(nombre, { description }, ...)`.
  await bot.syncCommands();
  console.log("[bot] menú de comandos sincronizado (setMyCommands)");
});

let apagando = false;
async function apagar(señal: string): Promise<void> {
  if (apagando) return;
  apagando = true;
  console.log(`[bot] recibida ${señal}, deteniendo long-polling...`);
  await bot.stop();
  process.exit(0);
}

process.once("SIGINT", () => void apagar("SIGINT"));
process.once("SIGTERM", () => void apagar("SIGTERM"));

await bot.start();
