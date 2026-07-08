/**
 * Copys en español del bot, centralizados para mantener un tono consistente.
 *
 * Formato: se usa el template `format` de GramIO (`@gramio/format`), que
 * produce un `FormattableString` (texto + entities de Telegram). No hay
 * `parse_mode` ni escapado manual: los valores dinámicos se interpolan tal
 * cual y solo los helpers (`bold`, `italic`, `code`, ...) generan entities.
 * `ctx.send()` acepta el `FormattableString` directamente.
 */
import type { FunctionReturnType } from "convex/server";
import { blockquote, bold, code, format, italic, join } from "gramio";
import type { FormattableString } from "gramio";
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

export function mensajeBienvenidaSinVincular(): FormattableString {
  return format`👋 Hola, bienvenido al bot operativo de ${bold`Auge Movilidad`}.

Tu cuenta de Telegram todavía no está vinculada a un conductor o usuario del sistema. Toca ${bold`«Vincular mi cuenta»`} (o usa ${code`/vincular <tu número de teléfono>`}) para registrar tu solicitud. Un coordinador la verificará y completará la vinculación en breve.`;
}

export function mensajePendienteVerificacion(): FormattableString {
  return format`⏳ Tu solicitud de vinculación está registrada y ${bold`pendiente de verificación`} por un coordinador. Te avisaremos apenas quede activa; mientras tanto puedes volver a intentar /start.`;
}

export function mensajeCuentaSuspendida(): FormattableString {
  return format`🚫 Tu cuenta de Telegram está ${bold`suspendida`}. Contacta a tu coordinador.`;
}

export function mensajeCuentaDesvinculada(): FormattableString {
  return format`Tu cuenta fue desvinculada. Toca ${bold`«Vincular mi cuenta»`} si necesitas volver a solicitar acceso.`;
}

export function mensajeBienvenidaVinculada(opciones: {
  nombre: string;
  esCoordinador: boolean;
  tipoUsuario?: string;
}): FormattableString {
  const rol = opciones.esCoordinador ? (opciones.tipoUsuario ?? "coordinador") : "conductor";
  return format`👋 Hola ${bold(opciones.nombre)} (${italic(rol)}).

¿Qué necesitas hacer? Toca un botón, o abre el menú ${code`/`} para ver todos los comandos.`;
}

export function mensajeSolicitudVinculacionRegistrada(): FormattableString {
  return format`📝 Solicitud de vinculación registrada. Un coordinador confirmará tu identidad en breve; mientras tanto usa /start para ver el estado.`;
}

export function mensajeYaVinculada(): string {
  return (
    "Ya tienes una cuenta vinculada. Si necesitas apuntarla a otra " +
    "identidad, primero usa /desvincular."
  );
}

export function mensajeFaltaTelefono(): FormattableString {
  return format`Escribe tu número de teléfono después del comando: ${code`/vincular 3001234567`}`;
}

export function mensajePideTelefonoVinculacion(): FormattableString {
  return format`🔗 Escribe tu número de teléfono (por ejemplo ${code`3001234567`}) para solicitar la vinculación:`;
}

export function mensajePideOperacionIdMenu(): string {
  return "🗺️ Escribe el id de la operación que quieres consultar:";
}

export function mensajeConfirmarDesvincular(): FormattableString {
  return format`¿Seguro que quieres ${bold`desvincular`} tu cuenta de Telegram? Dejarás de recibir tus servicios por este chat.`;
}

export function mensajeAccionCancelada(): string {
  return "Operación cancelada.";
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

export function lineaServicioCorto(servicio: ServicioCorto): FormattableString {
  const estadoAsignacion =
    ETIQUETAS_ESTADO_ASIGNACION[servicio.estadoAsignacion] ?? servicio.estadoAsignacion;
  const estadoServicio =
    ETIQUETAS_ESTADO_SERVICIO[servicio.estadoServicio] ?? servicio.estadoServicio;
  return format`🚐 ${bold`${servicio.fecha} ${servicio.hora}`} — ${servicio.origen} → ${servicio.destino}
Vehículo ${code(servicio.vehiculoPlaca)} · asignación ${italic(estadoAsignacion)} · servicio ${italic(estadoServicio)}`;
}

export function mensajeDetalleServicio(detalle: DetalleServicio): FormattableString {
  const lineas: FormattableString[] = [
    format`📋 ${bold`Servicio del ${detalle.fecha} ${detalle.hora}`}`,
    format`${bold`Cliente:`} ${detalle.clienteNombre}`,
    format`${bold`Operación:`} ${detalle.operacionNombre}`,
    format`${bold`Ruta:`} ${detalle.origen} → ${detalle.destino}`,
    format`${bold`Vehículo:`} ${code(detalle.vehiculoPlaca)}`,
    format`${bold`Estado asignación:`} ${italic(ETIQUETAS_ESTADO_ASIGNACION[detalle.estadoAsignacion] ?? detalle.estadoAsignacion)}`,
    format`${bold`Estado servicio:`} ${italic(ETIQUETAS_ESTADO_SERVICIO[detalle.estadoServicio] ?? detalle.estadoServicio)}`,
  ];
  if (detalle.pasajeros !== undefined) {
    lineas.push(format`${bold`Pasajeros previstos:`} ${detalle.pasajeros}`);
  }
  if (detalle.checklistResultado !== undefined) {
    lineas.push(format`${bold`Checklist:`} ${detalle.checklistResultado}`);
  }
  return join(lineas, "\n");
}

export function mensajeServicioNoEncontrado(): string {
  return "No encontré ese servicio o no está asignado a tu cuenta.";
}

export function mensajeAsignacionConfirmada(): string {
  return "✅ Asignación confirmada.";
}

export function mensajePideMotivoRechazo(): FormattableString {
  return format`Escribe el motivo del rechazo (${bold`obligatorio`}):`;
}

export function mensajeAsignacionRechazada(): string {
  return "❌ Asignación rechazada.";
}

export function mensajeChecklistIntro(): FormattableString {
  return format`📋 Marca cada ítem y toca ${bold`«Enviar checklist»`} cuando termines:`;
}

export function mensajeChecklistEnviado(): string {
  return "📋 Checklist enviado.";
}

export function mensajePideObservacionesChecklist(): FormattableString {
  return format`¿Observaciones del checklist? Escríbelas o toca ${bold`«Sin observaciones»`}.`;
}

export function mensajeServicioIniciado(): string {
  return "▶️ Servicio iniciado. Buen viaje.";
}

export function mensajePideUbicacion(): FormattableString {
  return format`📍 Envía tu ubicación de Telegram (${italic`clip 📎 → Ubicación`}) para reportarla en este servicio.`;
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

export function mensajePideNotaCierre(): FormattableString {
  return format`🏁 ¿Alguna nota de cierre? Escríbela o toca ${bold`«Sin nota de cierre»`}.`;
}

export function mensajePideCantidadPasajeros(): FormattableString {
  return format`¿Cuántos pasajeros se transportaron? Envía el número o toca ${bold`«No indicar cantidad»`}.`;
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

const ETIQUETAS_SEVERIDAD: Record<string, string> = {
  baja: "baja",
  media: "media",
  alta: "alta",
  critica: "CRÍTICA",
};

export function lineaIncidencia(incidencia: Incidencia): FormattableString {
  const fecha = new Date(incidencia.timestamp).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "short",
    timeStyle: "short",
  });
  const severidad = ETIQUETAS_SEVERIDAD[incidencia.severidad] ?? incidencia.severidad;
  return format`⚠️ ${bold(`[${severidad}] ${incidencia.tipo}`)} — ${italic(incidencia.estado)}
${blockquote(incidencia.descripcion)}
${italic(fecha)}`;
}

export function mensajeListaIncidencias(incidencias: Incidencia[]): FormattableString {
  return join(incidencias, lineaIncidencia, "\n\n");
}

export function mensajeSoloCoordinadores(): string {
  return "Este comando es solo para coordinadores/operadores.";
}

export function mensajeFaltaOperacionId(): FormattableString {
  return format`Escribe el id de la operación después del comando: ${code`/operacion <operacionId>`}`;
}

export function mensajeOperacionNoEncontrada(): string {
  return "No encontré esa operación, o tu cuenta no tiene permiso para verla.";
}

export function mensajeEstadoOperacion(estado: EstadoOperacion): FormattableString {
  return format`🗺️ ${bold(estado.operacionNombre)} (${italic(estado.estado)})
Servicios hoy: ${bold(estado.serviciosHoy)} · en curso: ${bold(estado.enCurso)} · completados: ${bold(estado.completadosHoy)}
Incidencias abiertas: ${bold(estado.incidenciasAbiertas)} (críticas: ${bold(estado.incidenciasCriticas)})`;
}

export function mensajeErrorGenerico(): string {
  return "⚠️ Ocurrió un error inesperado. Intenta de nuevo en un momento.";
}
