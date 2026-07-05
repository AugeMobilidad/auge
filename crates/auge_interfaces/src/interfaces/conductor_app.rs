//! App del conductor: SOLO acciones seguras para conductores.
//!
//! Todas las mutations subyacentes (`conductor*`) validan en Convex que el
//! servicio tenga una asignación del conductor resuelto (por `conductorId` o
//! por identidad Telegram vinculada); un conductor no puede tocar servicios
//! ajenos. Este módulo no conoce la API de Telegram: sirve igual para una app
//! móvil nativa.

use super::fachada;
use crate::convex_types::{
    AccionesoperativasConductorCerrarServicioArgs,
    AccionesoperativasConductorConfirmarAsignacionArgs,
    AccionesoperativasConductorEnviarChecklistArgs,
    AccionesoperativasConductorIniciarServicioArgs,
    AccionesoperativasConductorRechazarAsignacionArgs,
    AccionesoperativasConductorRegistrarEvidenciaArgs,
    AccionesoperativasConductorReportarIncidenciaArgs,
    AccionesoperativasConductorReportarUbicacionArgs,
    ApptelegramTelegramDetalleServicioArgs, ApptelegramTelegramIncidenciasAbiertasArgs,
    ApptelegramTelegramServiciosDeConductorArgs,
};

// --- Lectura ---
fachada!(
    /// Servicios de hoy/próximos del conductor (propuestos y confirmados).
    query mis_servicios => ApptelegramTelegramServiciosDeConductorArgs
);
fachada!(
    /// Detalle corto de un servicio propio + próximas acciones permitidas.
    query detalle_servicio => ApptelegramTelegramDetalleServicioArgs
);
fachada!(
    /// Incidencias abiertas de los servicios del conductor.
    query incidencias_abiertas => ApptelegramTelegramIncidenciasAbiertasArgs
);

// --- Acciones ---
fachada!(
    /// Confirma una asignación propuesta a este conductor.
    mutation confirmar_asignacion => AccionesoperativasConductorConfirmarAsignacionArgs
);
fachada!(
    /// Rechaza una asignación propuesta (motivo obligatorio).
    mutation rechazar_asignacion => AccionesoperativasConductorRechazarAsignacionArgs
);
fachada!(
    /// Envía el checklist preoperativo (mueve el servicio a `enPreparacion`).
    mutation enviar_checklist => AccionesoperativasConductorEnviarChecklistArgs
);
fachada!(
    /// Inicia el servicio (exige checklist aprobado).
    mutation iniciar_servicio => AccionesoperativasConductorIniciarServicioArgs
);
fachada!(
    /// Reporta ubicación GPS (fuente `telegram` o `appConductor`).
    mutation reportar_ubicacion => AccionesoperativasConductorReportarUbicacionArgs
);
fachada!(
    /// Registra evidencia (foto, firma, comentario…) del servicio propio.
    mutation registrar_evidencia => AccionesoperativasConductorRegistrarEvidenciaArgs
);
fachada!(
    /// Abre una incidencia sobre el servicio propio.
    mutation reportar_incidencia => AccionesoperativasConductorReportarIncidenciaArgs
);
fachada!(
    /// Cierra el servicio (exige evidencia previa o nota de cierre).
    mutation cerrar_servicio => AccionesoperativasConductorCerrarServicioArgs
);
