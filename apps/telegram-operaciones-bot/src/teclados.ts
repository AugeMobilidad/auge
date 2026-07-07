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
 * El id del servicio/asignación solo viaja en el botón que abre el flujo;
 * los pasos siguientes se resuelven contra el estado en `estado/sesiones.ts`.
 */
import { InlineKeyboard } from "gramio";
import type { Id } from "./tipos";
import type { ValoresChecklist } from "./estado/sesiones";

export function teclado(): InlineKeyboard {
  return new InlineKeyboard();
}

export function botonVerServicio(servicioId: Id<"serviciosTransporte">): InlineKeyboard {
  return teclado().text("Ver detalle", `sv:${servicioId}`);
}

/**
 * Arma el teclado de detalle de servicio a partir de `accionesPermitidas`.
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
  if (acciones.length === 0) return undefined;
  let kb = teclado();
  let botonesEnFila = 0;
  let huboBoton = false;
  const agregar = (label: string, data: string): void => {
    if (botonesEnFila === 2) {
      kb = kb.row();
      botonesEnFila = 0;
    }
    kb = kb.text(label, data);
    botonesEnFila += 1;
    huboBoton = true;
  };
  for (const accion of acciones) {
    switch (accion) {
      case "confirmarAsignacion":
        if (asignacionId !== null) agregar("✅ Confirmar", `cf:${asignacionId}`);
        break;
      case "rechazarAsignacion":
        if (asignacionId !== null) agregar("❌ Rechazar", `rc:${asignacionId}`);
        break;
      case "enviarChecklist":
        agregar("📋 Checklist", `ck:${servicioId}`);
        break;
      case "iniciarServicio":
        agregar("▶️ Iniciar servicio", `in:${servicioId}`);
        break;
      case "reportarUbicacion":
        agregar("📍 Reportar ubicación", `ub:${servicioId}`);
        break;
      case "registrarEvidencia":
        agregar("📷 Registrar evidencia", `ev:${servicioId}`);
        break;
      case "reportarIncidencia":
        agregar("⚠️ Reportar incidencia", `ic:${servicioId}`);
        break;
      case "cerrarServicio":
        agregar("🏁 Cerrar servicio", `ce:${servicioId}`);
        break;
      default:
        break;
    }
  }
  return huboBoton ? kb : undefined;
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
  let kb = teclado();
  ITEMS_CHECKLIST.forEach(({ campo, etiqueta }, i) => {
    const marca = valores[campo] ? "✅" : "⬜";
    kb = kb.text(`${marca} ${etiqueta}`, `ck:t:${campo}`);
    if (i % 2 === 1) kb = kb.row();
  });
  return kb.row().text("Enviar checklist", "ck:enviar");
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
  let kb = teclado();
  TIPOS_INCIDENCIA.forEach(({ valor, etiqueta }, i) => {
    kb = kb.text(etiqueta, `ic:t:${valor}`);
    if (i % 2 === 1) kb = kb.row();
  });
  return kb;
}

const SEVERIDADES: Array<{ valor: string; etiqueta: string }> = [
  { valor: "baja", etiqueta: "Baja" },
  { valor: "media", etiqueta: "Media" },
  { valor: "alta", etiqueta: "Alta" },
  { valor: "critica", etiqueta: "Crítica" },
];

export function tecladoSeveridadIncidencia(): InlineKeyboard {
  let kb = teclado();
  SEVERIDADES.forEach(({ valor, etiqueta }, i) => {
    kb = kb.text(etiqueta, `ic:s:${valor}`);
    if (i % 2 === 1) kb = kb.row();
  });
  return kb;
}

export function tecladoNotaCierre(): InlineKeyboard {
  return teclado().text("Sin nota de cierre", "ce:nota:no");
}

export function tecladoPasajerosCierre(): InlineKeyboard {
  return teclado().text("No indicar cantidad", "ce:pas:no");
}
