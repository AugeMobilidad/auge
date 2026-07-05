//! Fachada del futuro bot de Telegram (conductores + comandos ligeros de
//! coordinadores).
//!
//! Frontera de interfaz de la app: cada función corresponde a un comando o
//! acción del bot. NO implementa la API de Telegram (ni polling, ni webhooks,
//! ni tokens): el crate `telegram-operaciones-bot` hará ese cableado y llamará
//! estas funciones. La identidad viaja como `telegramUserId` y Convex resuelve
//! la cuenta vinculada; un conductor solo puede operar sus propios servicios.

use super::fachada;
use crate::convex_types::{
    AccionesoperativasActualizarUltimoComandoTelegramArgs,
    AccionesoperativasConductorCerrarServicioArgs,
    AccionesoperativasConductorConfirmarAsignacionArgs,
    AccionesoperativasConductorEnviarChecklistArgs,
    AccionesoperativasConductorIniciarServicioArgs,
    AccionesoperativasConductorRechazarAsignacionArgs,
    AccionesoperativasConductorRegistrarEvidenciaArgs,
    AccionesoperativasConductorReportarIncidenciaArgs,
    AccionesoperativasConductorReportarUbicacionArgs,
    AccionesoperativasDesvincularCuentaTelegramArgs,
    AccionesoperativasVincularCuentaTelegramArgs, ApptelegramTelegramDetalleServicioArgs,
    ApptelegramTelegramEstadoOperacionArgs, ApptelegramTelegramIncidenciasAbiertasArgs,
    ApptelegramTelegramResolverCuentaArgs, ApptelegramTelegramServiciosDeConductorArgs,
};

// --- Identidad (comando /start, /vincular) ---
fachada!(
    /// Resuelve la cuenta de Telegram: conductor/usuario vinculado y rol.
    query resolver_cuenta_telegram => ApptelegramTelegramResolverCuentaArgs
);
fachada!(
    /// Vincula (o re-vincula) una cuenta de Telegram a conductor/usuario.
    mutation vincular_cuenta_telegram => AccionesoperativasVincularCuentaTelegramArgs
);
fachada!(
    /// Desvincula la cuenta de Telegram.
    mutation desvincular_cuenta_telegram => AccionesoperativasDesvincularCuentaTelegramArgs
);
fachada!(
    /// Marca el instante del último comando recibido (telemetría de la cuenta).
    mutation actualizar_ultimo_comando => AccionesoperativasActualizarUltimoComandoTelegramArgs
);

// --- Flujo del conductor (comandos /misservicios, /servicio, etc.) ---
fachada!(
    /// Servicios de hoy/próximos del conductor, en forma corta para chat.
    query mis_servicios => ApptelegramTelegramServiciosDeConductorArgs
);
fachada!(
    /// Detalle corto de un servicio propio + `accionesPermitidas` para armar
    /// el teclado inline del bot.
    query detalle_servicio => ApptelegramTelegramDetalleServicioArgs
);
fachada!(
    /// Confirma una asignación propuesta.
    mutation confirmar_asignacion => AccionesoperativasConductorConfirmarAsignacionArgs
);
fachada!(
    /// Rechaza una asignación propuesta (motivo obligatorio).
    mutation rechazar_asignacion => AccionesoperativasConductorRechazarAsignacionArgs
);
fachada!(
    /// Envía el checklist preoperativo.
    mutation enviar_checklist => AccionesoperativasConductorEnviarChecklistArgs
);
fachada!(
    /// Inicia el servicio (exige checklist aprobado).
    mutation iniciar_servicio => AccionesoperativasConductorIniciarServicioArgs
);
fachada!(
    /// Reporta ubicación GPS desde el chat (fuente `telegram`).
    mutation reportar_ubicacion => AccionesoperativasConductorReportarUbicacionArgs
);
fachada!(
    /// Registra evidencia (foto/comentario) del servicio propio.
    mutation registrar_evidencia => AccionesoperativasConductorRegistrarEvidenciaArgs
);
fachada!(
    /// Abre una incidencia sobre el servicio propio.
    mutation reportar_incidencia => AccionesoperativasConductorReportarIncidenciaArgs
);
fachada!(
    /// Cierra el servicio (exige evidencia o nota de cierre).
    mutation cerrar_servicio => AccionesoperativasConductorCerrarServicioArgs
);

// --- Comandos ligeros de coordinador ---
fachada!(
    /// Incidencias abiertas relevantes al conductor (o globales si la cuenta
    /// vinculada es de coordinador/operador).
    query incidencias_abiertas => ApptelegramTelegramIncidenciasAbiertasArgs
);
fachada!(
    /// Estado corto de una operación; solo responde a cuentas de
    /// coordinador/operador/admin vinculadas.
    query estado_operacion => ApptelegramTelegramEstadoOperacionArgs
);
