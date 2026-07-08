/**
 * Teclados inline del bot. Convenciones de `callback_data` (siempre cortas,
 * bien por debajo del límite de 64 bytes de Telegram):
 *
 *   sv:<servicioId>   ver detalle de un servicio
 *   cf:<asignacionId> confirmar asignación
 *   rc:<asignacionId> iniciar rechazo (pide motivo por texto)
 *   ck:<servicioId>   iniciar checklist preoperativo
 *   ck:t:<campo>      alternar un ítem del checklist en curso
 *   ck:enviar         enviar el checklist en curso
 *   ck:obs:no         enviar el checklist sin observaciones
 *   in:<servicioId>   iniciar servicio
 *   ub:<servicioId>   fijar el servicio objetivo para reportar ubicación
 *   ev:<servicioId>   fijar el servicio objetivo para registrar evidencia
 *   ic:<servicioId>   iniciar reporte de incidencia
 *   ic:t:<tipo>       paso "tipo" del asistente de incidencia
 *   ic:s:<severidad>  paso "severidad" del asistente de incidencia
 *   ce:<servicioId>   iniciar cierre de servicio
 *   ce:nota:no        cierre sin nota
 *   ce:pas:no         cierre sin cantidad de pasajeros (finaliza)
 *
 *   menu:servicios       lo mismo que /misservicios
 *   menu:incidencia      lo mismo que /incidencia
 *   menu:incidencias     lo mismo que /incidencias (coordinación)
 *   menu:operacion       asistente que pide el id de operación (coordinación)
 *   menu:vincular        asistente que pide el teléfono para vincular
 *   menu:desvincular     pide confirmación antes de desvincular
 *   menu:desvincular:si  confirma la desvinculación
 *   menu:cancelar        cancela la acción del menú en curso
 *
 * El id del servicio/asignación solo viaja en el botón que abre el flujo;
 * los pasos siguientes se resuelven contra el estado en `estado/sesiones.ts`.
 */
import { InlineKeyboard } from "gramio";
import type { TelegramInlineKeyboardButton } from "gramio";
import type { Id } from "./tipos";
import type { ValoresChecklist } from "./estado/sesiones";

export function teclado(): InlineKeyboard {
  return new InlineKeyboard();
}

export function botonVerServicio(servicioId: Id<"serviciosTransporte">): InlineKeyboard {
  return teclado().text("Ver detalle", `sv:${servicioId}`);
}

/**
 * Menú principal que acompaña a /start cuando la cuenta está vinculada:
 * las mismas acciones que los comandos, pero en botones.
 */
export function tecladoMenuPrincipal(esCoordinador: boolean): InlineKeyboard {
  const botones = [
    InlineKeyboard.text("🚐 Mis servicios", "menu:servicios"),
    InlineKeyboard.text("⚠️ Reportar incidencia", "menu:incidencia"),
  ];
  if (esCoordinador) {
    botones.push(
      InlineKeyboard.text("📋 Incidencias abiertas", "menu:incidencias"),
      InlineKeyboard.text("🗺️ Estado de operación", "menu:operacion"),
    );
  }
  botones.push(InlineKeyboard.text("🔓 Desvincular cuenta", "menu:desvincular"));
  return teclado().columns(2).add(...botones);
}

/** Acompaña a /start cuando la cuenta no está vinculada (o quedó desvinculada). */
export function tecladoVincular(): InlineKeyboard {
  return teclado().text("🔗 Vincular mi cuenta", "menu:vincular", { style: "primary" });
}

export function tecladoConfirmarDesvincular(): InlineKeyboard {
  return teclado()
    .text("Sí, desvincular", "menu:desvincular:si", { style: "danger" })
    .text("Cancelar", "menu:cancelar");
}

/**
 * Arma el teclado de detalle de servicio a partir de `accionesPermitidas`.
 * El armado es declarativo: se juntan los botones y `.columns(2)` se encarga
 * del salto de fila (sin contadores manuales).
 *
 * `asignacionId` es `null` cuando no se pudo resolver (ver
 * `vistas.ts::mostrarDetalleServicio`): en ese caso las acciones que la
 * necesitan (confirmar/rechazar) simplemente no se muestran, en vez de
 * armar un botón con un id inventado.
 */
export function tecladoAccionesServicio(
  servicioId: Id<"serviciosTransporte">,
  asignacionId: Id<"asignacionesServicio"> | null,
  acciones: readonly string[],
): InlineKeyboard | undefined {
  const botones: TelegramInlineKeyboardButton[] = [];
  for (const accion of acciones) {
    switch (accion) {
      case "confirmarAsignacion":
        if (asignacionId !== null)
          botones.push(InlineKeyboard.text("✅ Confirmar", `cf:${asignacionId}`, { style: "success" }));
        break;
      case "rechazarAsignacion":
        if (asignacionId !== null)
          botones.push(InlineKeyboard.text("❌ Rechazar", `rc:${asignacionId}`, { style: "danger" }));
        break;
      case "enviarChecklist":
        botones.push(InlineKeyboard.text("📋 Checklist", `ck:${servicioId}`));
        break;
      case "iniciarServicio":
        botones.push(InlineKeyboard.text("▶️ Iniciar servicio", `in:${servicioId}`));
        break;
      case "reportarUbicacion":
        botones.push(InlineKeyboard.text("📍 Reportar ubicación", `ub:${servicioId}`));
        break;
      case "registrarEvidencia":
        botones.push(InlineKeyboard.text("📷 Registrar evidencia", `ev:${servicioId}`));
        break;
      case "reportarIncidencia":
        botones.push(InlineKeyboard.text("⚠️ Reportar incidencia", `ic:${servicioId}`));
        break;
      case "cerrarServicio":
        botones.push(InlineKeyboard.text("🏁 Cerrar servicio", `ce:${servicioId}`));
        break;
      default:
        break;
    }
  }
  if (botones.length === 0) return undefined;
  return teclado().columns(2).add(...botones);
}

const ITEMS_CHECKLIST: Array<{ campo: keyof ValoresChecklist; etiqueta: string }> = [
  { campo: "combustibleOk", etiqueta: "Combustible" },
  { campo: "llantasOk", etiqueta: "Llantas" },
  { campo: "lucesOk", etiqueta: "Luces" },
  { campo: "documentosOk", etiqueta: "Documentos" },
  { campo: "limpiezaOk", etiqueta: "Limpieza" },
  { campo: "gpsOk", etiqueta: "GPS" },
];

export function tecladoChecklist(valores: ValoresChecklist): InlineKeyboard {
  // pattern([2,2,2,1]): ítems de a dos por fila y «Enviar» solo en la última.
  // (No sirve columns(2): aplanaría también el botón de envío.)
  return teclado()
    .pattern([2, 2, 2, 1])
    .add(
      ...ITEMS_CHECKLIST.map(({ campo, etiqueta }) =>
        InlineKeyboard.text(`${valores[campo] ? "✅" : "⬜"} ${etiqueta}`, `ck:t:${campo}`),
      ),
    )
    .text("Enviar checklist", "ck:enviar", { style: "primary" });
}

export function campoChecklistDesdeCallback(valor: string): keyof ValoresChecklist | null {
  const encontrado = ITEMS_CHECKLIST.find((item) => item.campo === valor);
  return encontrado?.campo ?? null;
}

export function tecladoObservacionesChecklist(): InlineKeyboard {
  return teclado().text("Sin observaciones", "ck:obs:no");
}

const TIPOS_INCIDENCIA: Array<{ valor: string; etiqueta: string }> = [
  { valor: "retraso", etiqueta: "Retraso" },
  { valor: "noShow", etiqueta: "No-show" },
  { valor: "fallaVehiculo", etiqueta: "Falla de vehículo" },
  { valor: "cambioRuta", etiqueta: "Cambio de ruta" },
  { valor: "accidente", etiqueta: "Accidente" },
  { valor: "queja", etiqueta: "Queja" },
  { valor: "contingencia", etiqueta: "Contingencia" },
  { valor: "otro", etiqueta: "Otro" },
];

export function tecladoTipoIncidencia(): InlineKeyboard {
  return teclado()
    .columns(2)
    .add(...TIPOS_INCIDENCIA.map(({ valor, etiqueta }) => InlineKeyboard.text(etiqueta, `ic:t:${valor}`)));
}

const SEVERIDADES: Array<{ valor: string; etiqueta: string }> = [
  { valor: "baja", etiqueta: "Baja" },
  { valor: "media", etiqueta: "Media" },
  { valor: "alta", etiqueta: "Alta" },
  { valor: "critica", etiqueta: "Crítica" },
];

export function tecladoSeveridadIncidencia(): InlineKeyboard {
  return teclado()
    .columns(2)
    .add(
      ...SEVERIDADES.map(({ valor, etiqueta }) =>
        InlineKeyboard.text(etiqueta, `ic:s:${valor}`, valor === "critica" ? { style: "danger" } : undefined),
      ),
    );
}

export function tecladoNotaCierre(): InlineKeyboard {
  return teclado().text("Sin nota de cierre", "ce:nota:no");
}

export function tecladoPasajerosCierre(): InlineKeyboard {
  return teclado().text("No indicar cantidad", "ce:pas:no");
}
