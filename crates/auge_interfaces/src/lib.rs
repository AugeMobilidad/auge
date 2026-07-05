//! Interfaces tipadas de Auge Movilidad.
//!
//! Este crate es la frontera entre las apps (dashboard web, bot de Telegram,
//! portales) y la ontología Convex. Las apps no tocan tablas: llaman fachadas
//! por perfil de usuario que envuelven las queries/mutations de Convex.

pub mod client;
pub mod convex_types;
pub mod interfaces;

pub use client::{AugeClient, AugeError, AugeResult};
/// Re-export para que las apps construyan/lean valores JSON sin depender
/// directamente de serde_json (los tipos generados usan esta misma versión).
pub use convex_typegen::serde_json;
