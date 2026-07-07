/**
 * Copys en español del bot, centralizados para mantener un tono consistente.
 */
import type { FunctionReturnType } from "convex/server";
import type { api } from "./tipos";

type ServicioCorto = FunctionReturnType<typeof api.appTelegram.telegramServiciosDeConductor>[number];
type DetalleServicio = NonNullable<
  FunctionReturnType<typeof api.appTelegram.telegramDetalleServicio>
>;
type Incidencia = FunctionReturnType<typeof api.appTelegram.telegramIncidenciasAbiertas>[number];
type EstadoOperacion = NonNullable<
  FunctionReturnType<typeof api.appTelegram.telegramEstadoOperacion>
>;

const ETIQUETAS_ESTADO_ASIGNACION: Record<string, string> = {
  propuesta: "propuesta",
  confirmada: "confirmada",
  rechazada: "rechazada",
  completada: "completada",
};

const ETIQUETAS_ESTADO_SERVICIO: Record<string, string> = {
  programado: "programado",
  asignado: "asignado",
  enPreparacion: "en preparación",
  enCurso: "en curso",
  completado: "completado",
  cancelado: "cancelado",
  fallido: "fallido",
};

export function mensajeBienvenidaSinVincular(): string {
  return (
    "👋 Hola, bienvenido al bot operativo de Auge Movilidad.\n\n" +
    "Tu cuenta de Telegram todavía no está vinculada a un conductor o usuario " +
    "del sistema. Usa:\n\n" +
    "  /vincular <tu número de teléfono>\n\n" +
    "para registrar tu solicitud. Un coordinador la verificará y completará " +
    "la vinculación en breve."
  );
}

export function mensajePendienteVerificacion(): string {
  return (
    "⏳ Tu solicitud de vinculación está registrada y pendiente de " +
    "verificación por un coordinador. Te avisaremos apenas quede activa; " +
    "mientras tanto puedes volver a intentar /start."
  );
}

export function mensajeCuentaSuspendida(): string {
  return "🚫 Tu cuenta de Telegram está suspendida. Contacta a tu coordinador.";
}

export function mensajeCuentaDesvinculada(): string {
  return (
    "Tu cuenta fue desvinculada. Usa /vincular <tu número de teléfono> si " +
    "necesitas volver a solicitar acceso."
  );
}

export function mensajeBienvenidaVinculada(opciones: {
  nombre: string;
  esCoordinador: boolean;
  tipoUsuario?: string;
}): string {
  const rol = opciones.esCoordinador ? (opciones.tipoUsuario ?? "coordinador") : "conductor";
  const comandosConductor =
    "  /misservicios – servicios de hoy y próximos\n" +
    "  /incidencia – reportar una incidencia\n" +
    "  /vincular – re-vincular cuenta\n" +
    "  /desvincular – desvincular cuenta";
  const comandosCoordinador =
    "\n\nComandos de coordinación:\n" +
    "  /incidencias – incidencias abiertas\n" +
    "  /operacion <operacionId> – estado corto de una operación";
  return (
    `👋 Hola ${opciones.nombre} (${rol}).\n\n` +
    `Comandos disponibles:\n${comandosConductor}` +
    (opciones.esCoordinador ? comandosCoordinador : "")
  );
}

export function mensajeSolicitudVinculacionRegistrada(): string {
  return (
    "📝 Solicitud de vinculación registrada. Un coordinador confirmará tu " +
    "identidad en breve; mientras tanto usa /start para ver el estado."
  );
}

export function mensajeYaVinculada(): string {
  return (
    "Ya tienes una cuenta vinculada. Si necesitas apuntarla a otra " +
    "identidad, primero usa /desvincular."
  );
}

export function mensajeFaltaTelefono(): string {
  return "Escribe tu número de teléfono después del comando: /vincular 3001234567";
}

export function mensajeDesvinculada(): string {
  return "🔓 Tu cuenta de Telegram quedó desvinculada.";
}

export function mensajeSinCuentaParaDesvincular(): string {
  return "No tienes una cuenta de Telegram registrada para desvincular.";
}

export function mensajeSinServicios(): string {
  return "No tienes servicios programados para hoy ni próximos.";
}

export function mensajeSoloConductores(): string {
  return "Este comando es solo para conductores.";
}

export function mensajeServiciosActivos(): string {
  return "Estos son tus servicios en curso. Abre el detalle para reportar la incidencia:";
}

export function lineaServicioCorto(servicio: ServicioCorto): string {
  return (
    `🚐 ${servicio.fecha} ${servicio.hora} — ${servicio.origen} → ${servicio.destino}\n` +
    `   Vehículo ${servicio.vehiculoPlaca} · asignación ${ETIQUETAS_ESTADO_ASIGNACION[servicio.estadoAsignacion] ?? servicio.estadoAsignacion} · servicio ${ETIQUETAS_ESTADO_SERVICIO[servicio.estadoServicio] ?? servicio.estadoServicio}`
  );
}

export function mensajeDetalleServicio(detalle: DetalleServicio): string {
  const lineas = [
    `📋 Servicio del ${detalle.fecha} ${detalle.hora}`,
    `Cliente: ${detalle.clienteNombre}`,
    `Operación: ${detalle.operacionNombre}`,
    `Ruta: ${detalle.origen} → ${detalle.destino}`,
    `Vehículo: ${detalle.vehiculoPlaca}`,
    `Estado asignación: ${ETIQUETAS_ESTADO_ASIGNACION[detalle.estadoAsignacion] ?? detalle.estadoAsignacion}`,
    `Estado servicio: ${ETIQUETAS_ESTADO_SERVICIO[detalle.estadoServicio] ?? detalle.estadoServicio}`,
  ];
  if (detalle.pasajeros !== undefined) lineas.push(`Pasajeros previstos: ${detalle.pasajeros}`);
  if (detalle.checklistResultado !== undefined) {
    lineas.push(`Checklist: ${detalle.checklistResultado}`);
  }
  return lineas.join("\n");
}

export function mensajeServicioNoEncontrado(): string {
  return "No encontré ese servicio o no está asignado a tu cuenta.";
}

export function mensajeAsignacionConfirmada(): string {
  return "✅ Asignación confirmada.";
}

export function mensajePideMotivoRechazo(): string {
  return "Escribe el motivo del rechazo (obligatorio):";
}

export function mensajeAsignacionRechazada(): string {
  return "❌ Asignación rechazada.";
}

export function mensajeChecklistIntro(): string {
  return "📋 Marca cada ítem y toca «Enviar checklist» cuando termines:";
}

export function mensajeChecklistEnviado(): string {
  return "📋 Checklist enviado.";
}

export function mensajePideObservacionesChecklist(): string {
  return "¿Observaciones del checklist? Escríbelas o toca «Sin observaciones».";
}

export function mensajeServicioIniciado(): string {
  return "▶️ Servicio iniciado. Buen viaje.";
}

export function mensajePideUbicacion(): string {
  return (
    "📍 Envía tu ubicación de Telegram (clip 📎 → Ubicación) para reportarla " +
    "en este servicio."
  );
}

export function mensajeUbicacionRegistrada(): string {
  return "📍 Ubicación registrada.";
}

export function mensajeSinServicioEnCurso(): string {
  return (
    "No tienes un servicio en curso ahora mismo. Abre el detalle del " +
    "servicio y toca la acción correspondiente primero."
  );
}

export function mensajePideEvidencia(): string {
  return "📷 Envía la foto de evidencia para este servicio.";
}

export function mensajeEvidenciaRegistrada(): string {
  return "📷 Evidencia registrada.";
}

export function mensajePideTipoIncidencia(): string {
  return "⚠️ ¿Qué tipo de incidencia es?";
}

export function mensajePideSeveridadIncidencia(): string {
  return "¿Qué tan grave es?";
}

export function mensajePideDescripcionIncidencia(): string {
  return "Describe brevemente qué pasó:";
}

export function mensajeIncidenciaRegistrada(): string {
  return "⚠️ Incidencia registrada. Un coordinador la revisará.";
}

export function mensajePideNotaCierre(): string {
  return "🏁 ¿Alguna nota de cierre? Escríbela o toca «Sin nota de cierre».";
}

export function mensajePideCantidadPasajeros(): string {
  return "¿Cuántos pasajeros se transportaron? Envía el número o toca «No indicar cantidad».";
}

export function mensajeNumeroInvalido(): string {
  return "Eso no parece un número. Intenta de nuevo o toca el botón para omitir.";
}

export function mensajeServicioCerrado(): string {
  return "🏁 Servicio cerrado. Buen trabajo.";
}

export function mensajeSinIncidencias(): string {
  return "No hay incidencias abiertas.";
}

export function lineaIncidencia(incidencia: Incidencia): string {
  const fecha = new Date(incidencia.timestamp).toISOString();
  return (
    `⚠️ [${incidencia.severidad}] ${incidencia.tipo} — ${incidencia.estado}\n` +
    `   ${incidencia.descripcion}\n` +
    `   ${fecha}`
  );
}

export function mensajeSoloCoordinadores(): string {
  return "Este comando es solo para coordinadores/operadores.";
}

export function mensajeFaltaOperacionId(): string {
  return "Escribe el id de la operación después del comando: /operacion <operacionId>";
}

export function mensajeOperacionNoEncontrada(): string {
  return "No encontré esa operación, o tu cuenta no tiene permiso para verla.";
}

export function mensajeEstadoOperacion(estado: EstadoOperacion): string {
  return (
    `🗺️ ${estado.operacionNombre} (${estado.estado})\n` +
    `Servicios hoy: ${estado.serviciosHoy} · en curso: ${estado.enCurso} · completados: ${estado.completadosHoy}\n` +
    `Incidencias abiertas: ${estado.incidenciasAbiertas} (críticas: ${estado.incidenciasCriticas})`
  );
}

export function mensajeErrorGenerico(): string {
  return "⚠️ Ocurrió un error inesperado. Intenta de nuevo en un momento.";
}
