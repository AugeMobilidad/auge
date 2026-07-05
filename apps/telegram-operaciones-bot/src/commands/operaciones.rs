//! Comandos operativos ligeros para coordinadores/operadores vinculados.
//! Convex verifica que la cuenta de Telegram pertenezca a un usuario con rol
//! de coordinación antes de responder.

use auge_interfaces::convex_types::{
    ApptelegramTelegramEstadoOperacionArgs, ApptelegramTelegramIncidenciasAbiertasArgs,
};
use auge_interfaces::interfaces::telegram_operaciones_bot as bot;
use auge_interfaces::serde_json::Value;
use auge_interfaces::{AugeClient, AugeResult};

use super::{ContextoChat, DescriptorComando};

pub const COMANDOS: &[DescriptorComando] = &[
    DescriptorComando {
        comando: "/operacion",
        descripcion: "Estado corto de una operación (solo coordinadores)",
    },
    DescriptorComando {
        comando: "/incidencias",
        descripcion: "Incidencias abiertas globales (solo coordinadores)",
    },
];

pub async fn estado_operacion(
    client: &mut AugeClient,
    ctx: &ContextoChat,
    operacion_id: String,
) -> AugeResult<Value> {
    bot::estado_operacion(
        client,
        ApptelegramTelegramEstadoOperacionArgs {
            telegramUserId: ctx.telegram_user_id.clone(),
            operacionId: operacion_id,
        },
    )
    .await
}

pub async fn incidencias_abiertas(
    client: &mut AugeClient,
    ctx: &ContextoChat,
) -> AugeResult<Value> {
    bot::incidencias_abiertas(
        client,
        ApptelegramTelegramIncidenciasAbiertasArgs {
            telegramUserId: Some(ctx.telegram_user_id.clone()),
            conductorId: None,
        },
    )
    .await
}
