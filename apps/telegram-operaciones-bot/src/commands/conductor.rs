//! Comandos del conductor: cada función es el handler de un comando del chat
//! y delega en la fachada `interfaces::telegram_operaciones_bot`.

use auge_interfaces::convex_types::{
    AccionesoperativasConductorCerrarServicioArgs,
    AccionesoperativasConductorConfirmarAsignacionArgs,
    AccionesoperativasConductorEnviarChecklistArgs,
    AccionesoperativasConductorIniciarServicioArgs,
    AccionesoperativasConductorRechazarAsignacionArgs,
    AccionesoperativasConductorRegistrarEvidenciaArgs,
    AccionesoperativasConductorReportarIncidenciaArgs,
    AccionesoperativasConductorReportarUbicacionArgs, ApptelegramTelegramDetalleServicioArgs,
    ApptelegramTelegramIncidenciasAbiertasArgs, ApptelegramTelegramResolverCuentaArgs,
    ApptelegramTelegramServiciosDeConductorArgs,
};
use auge_interfaces::interfaces::telegram_operaciones_bot as bot;
use auge_interfaces::serde_json::{json, Value};
use auge_interfaces::{AugeClient, AugeResult};

use std::collections::BTreeMap;

use super::{ContextoChat, DescriptorComando};

/// Convierte (lat, lng) al mapa geo que esperan los tipos generados.
fn geo_map((lat, lng): (f64, f64)) -> BTreeMap<String, f64> {
    BTreeMap::from([("lat".to_string(), lat), ("lng".to_string(), lng)])
}

pub const COMANDOS: &[DescriptorComando] = &[
    DescriptorComando { comando: "/start", descripcion: "Vincular identidad y ver estado de la cuenta" },
    DescriptorComando { comando: "/misservicios", descripcion: "Servicios asignados de hoy y próximos" },
    DescriptorComando { comando: "/servicio", descripcion: "Detalle de un servicio y acciones disponibles" },
    DescriptorComando { comando: "/confirmar", descripcion: "Confirmar una asignación propuesta" },
    DescriptorComando { comando: "/rechazar", descripcion: "Rechazar una asignación (con motivo)" },
    DescriptorComando { comando: "/checklist", descripcion: "Enviar checklist preoperativo" },
    DescriptorComando { comando: "/iniciar", descripcion: "Iniciar el servicio" },
    DescriptorComando { comando: "/ubicacion", descripcion: "Reportar ubicación GPS" },
    DescriptorComando { comando: "/evidencia", descripcion: "Registrar evidencia del servicio" },
    DescriptorComando { comando: "/incidencia", descripcion: "Reportar una incidencia" },
    DescriptorComando { comando: "/cerrar", descripcion: "Cerrar el servicio con nota o evidencia" },
    DescriptorComando { comando: "/pendientes", descripcion: "Incidencias abiertas propias" },
];

// --- DTOs de entrada (lo que el adaptador parsea del mensaje del chat) ---

#[derive(Debug, Clone)]
pub struct ChecklistDto {
    pub servicio_id: String,
    pub combustible_ok: bool,
    pub llantas_ok: bool,
    pub luces_ok: bool,
    pub documentos_ok: bool,
    pub limpieza_ok: bool,
    pub gps_ok: bool,
    pub observaciones: Option<String>,
}

#[derive(Debug, Clone)]
pub struct UbicacionDto {
    pub servicio_id: String,
    pub lat: f64,
    pub lng: f64,
    pub velocidad: Option<f64>,
}

#[derive(Debug, Clone)]
pub struct EvidenciaDto {
    pub servicio_id: String,
    /// "foto" | "firma" | "documento" | "comentario" | "telegram" | "otro"
    pub tipo: String,
    pub descripcion: String,
    pub archivo_url: Option<String>,
}

#[derive(Debug, Clone)]
pub struct IncidenciaDto {
    pub servicio_id: String,
    /// "retraso" | "noShow" | "fallaVehiculo" | "cambioRuta" | "accidente" | "queja" | "contingencia" | "otro"
    pub tipo: String,
    /// "baja" | "media" | "alta" | "critica"
    pub severidad: String,
    pub descripcion: String,
}

#[derive(Debug, Clone)]
pub struct CierreDto {
    pub servicio_id: String,
    pub nota_cierre: Option<String>,
    pub cantidad_pasajeros_real: Option<f64>,
    pub geo: Option<(f64, f64)>,
}

// --- Handlers ---

pub async fn start(client: &mut AugeClient, ctx: &ContextoChat) -> AugeResult<Value> {
    bot::resolver_cuenta_telegram(
        client,
        ApptelegramTelegramResolverCuentaArgs {
            telegramUserId: ctx.telegram_user_id.clone(),
        },
    )
    .await
}

pub async fn mis_servicios(client: &mut AugeClient, ctx: &ContextoChat) -> AugeResult<Value> {
    bot::mis_servicios(
        client,
        ApptelegramTelegramServiciosDeConductorArgs {
            telegramUserId: Some(ctx.telegram_user_id.clone()),
            conductorId: None,
        },
    )
    .await
}

pub async fn detalle_servicio(
    client: &mut AugeClient,
    ctx: &ContextoChat,
    servicio_id: String,
) -> AugeResult<Value> {
    bot::detalle_servicio(
        client,
        ApptelegramTelegramDetalleServicioArgs {
            telegramUserId: Some(ctx.telegram_user_id.clone()),
            conductorId: None,
            servicioId: servicio_id,
        },
    )
    .await
}

pub async fn confirmar(
    client: &mut AugeClient,
    ctx: &ContextoChat,
    asignacion_id: String,
) -> AugeResult<Value> {
    bot::confirmar_asignacion(
        client,
        AccionesoperativasConductorConfirmarAsignacionArgs {
            telegramUserId: Some(ctx.telegram_user_id.clone()),
            conductorId: None,
            asignacionId: asignacion_id,
        },
    )
    .await
}

pub async fn rechazar(
    client: &mut AugeClient,
    ctx: &ContextoChat,
    asignacion_id: String,
    motivo: String,
) -> AugeResult<Value> {
    bot::rechazar_asignacion(
        client,
        AccionesoperativasConductorRechazarAsignacionArgs {
            telegramUserId: Some(ctx.telegram_user_id.clone()),
            conductorId: None,
            asignacionId: asignacion_id,
            motivo,
        },
    )
    .await
}

pub async fn checklist(
    client: &mut AugeClient,
    ctx: &ContextoChat,
    dto: ChecklistDto,
) -> AugeResult<Value> {
    bot::enviar_checklist(
        client,
        AccionesoperativasConductorEnviarChecklistArgs {
            telegramUserId: Some(ctx.telegram_user_id.clone()),
            conductorId: None,
            servicioId: dto.servicio_id,
            combustibleOk: dto.combustible_ok,
            llantasOk: dto.llantas_ok,
            lucesOk: dto.luces_ok,
            documentosOk: dto.documentos_ok,
            limpiezaOk: dto.limpieza_ok,
            gpsOk: dto.gps_ok,
            observaciones: dto.observaciones,
        },
    )
    .await
}

pub async fn iniciar(
    client: &mut AugeClient,
    ctx: &ContextoChat,
    servicio_id: String,
    geo: Option<(f64, f64)>,
) -> AugeResult<Value> {
    bot::iniciar_servicio(
        client,
        AccionesoperativasConductorIniciarServicioArgs {
            telegramUserId: Some(ctx.telegram_user_id.clone()),
            conductorId: None,
            servicioId: servicio_id,
            geo: geo.map(geo_map),
            fuente: Some(json!("telegram")),
        },
    )
    .await
}

pub async fn ubicacion(
    client: &mut AugeClient,
    ctx: &ContextoChat,
    dto: UbicacionDto,
) -> AugeResult<Value> {
    bot::reportar_ubicacion(
        client,
        AccionesoperativasConductorReportarUbicacionArgs {
            telegramUserId: Some(ctx.telegram_user_id.clone()),
            conductorId: None,
            servicioId: dto.servicio_id,
            lat: dto.lat,
            lng: dto.lng,
            velocidad: dto.velocidad,
            fuente: json!("telegram"),
            evento: None,
        },
    )
    .await
}

pub async fn evidencia(
    client: &mut AugeClient,
    ctx: &ContextoChat,
    dto: EvidenciaDto,
) -> AugeResult<Value> {
    bot::registrar_evidencia(
        client,
        AccionesoperativasConductorRegistrarEvidenciaArgs {
            telegramUserId: Some(ctx.telegram_user_id.clone()),
            conductorId: None,
            servicioId: dto.servicio_id,
            tipo: json!(dto.tipo),
            descripcion: dto.descripcion,
            archivoUrl: dto.archivo_url,
        },
    )
    .await
}

pub async fn incidencia(
    client: &mut AugeClient,
    ctx: &ContextoChat,
    dto: IncidenciaDto,
) -> AugeResult<Value> {
    bot::reportar_incidencia(
        client,
        AccionesoperativasConductorReportarIncidenciaArgs {
            telegramUserId: Some(ctx.telegram_user_id.clone()),
            conductorId: None,
            servicioId: dto.servicio_id,
            tipo: json!(dto.tipo),
            severidad: json!(dto.severidad),
            descripcion: dto.descripcion,
        },
    )
    .await
}

pub async fn cerrar(
    client: &mut AugeClient,
    ctx: &ContextoChat,
    dto: CierreDto,
) -> AugeResult<Value> {
    bot::cerrar_servicio(
        client,
        AccionesoperativasConductorCerrarServicioArgs {
            telegramUserId: Some(ctx.telegram_user_id.clone()),
            conductorId: None,
            servicioId: dto.servicio_id,
            notaCierre: dto.nota_cierre,
            cantidadPasajerosReal: dto.cantidad_pasajeros_real,
            geo: dto.geo.map(geo_map),
            fuente: Some(json!("telegram")),
        },
    )
    .await
}

pub async fn pendientes(client: &mut AugeClient, ctx: &ContextoChat) -> AugeResult<Value> {
    bot::incidencias_abiertas(
        client,
        ApptelegramTelegramIncidenciasAbiertasArgs {
            telegramUserId: Some(ctx.telegram_user_id.clone()),
            conductorId: None,
        },
    )
    .await
}
