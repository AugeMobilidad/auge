//! Fachadas tipadas por perfil de usuario.
//!
//! Cada módulo es una frontera de interfaz: nombres estables de negocio,
//! argumentos tipados generados por `convex-typegen` y cero preocupaciones de
//! UI o de la API de Telegram. Los módulos `web_dashboard_logistica` y
//! `telegram_operaciones_bot` son las fachadas específicas de las dos apps;
//! el resto son fronteras por perfil (cliente, despacho, conductor,
//! propietario, gestor, eventos, cumplimiento).
//!
//! Seguridad por construcción:
//! - Las funciones que envuelven mutations `conductor*` solo actúan sobre
//!   servicios asignados al conductor resuelto (regla aplicada en Convex).
//! - Las funciones que envuelven mutations `dashboard*` exigen
//!   `actorUsuarioSistemaId` y el permiso correspondiente.

pub mod centro_control_eventos;
pub mod cliente_portal;
pub mod conductor_app;
pub mod cumplimiento_admin;
pub mod gestor_validado;
pub mod operaciones_console;
pub mod propietario_portal;
pub mod telegram_operaciones_bot;
pub mod web_dashboard_logistica;

/// Genera una función de fachada que llama una query/mutation de Convex con
/// su struct de argumentos generado (el `FUNCTION_PATH` viene del struct).
macro_rules! fachada {
    ($(#[$doc:meta])* query $nombre:ident => $args:ty) => {
        $(#[$doc])*
        pub async fn $nombre(
            client: &mut $crate::client::AugeClient,
            args: $args,
        ) -> $crate::client::AugeResult<convex_typegen::serde_json::Value> {
            client.query_tipada(<$args>::FUNCTION_PATH, args).await
        }
    };
    ($(#[$doc:meta])* mutation $nombre:ident => $args:ty) => {
        $(#[$doc])*
        pub async fn $nombre(
            client: &mut $crate::client::AugeClient,
            args: $args,
        ) -> $crate::client::AugeResult<convex_typegen::serde_json::Value> {
            client.mutation_tipada(<$args>::FUNCTION_PATH, args).await
        }
    };
}

pub(crate) use fachada;
