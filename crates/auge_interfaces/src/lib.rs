//! Interfaces tipadas de Auge Movilidad.
//!
//! Este crate es la frontera entre las apps (dashboard web, bot de Telegram,
//! portales) y la ontología Convex. Las apps no tocan tablas: llaman fachadas
//! por perfil de usuario que envuelven las queries/mutations de Convex.

pub mod client;
pub mod convex_types;
pub mod interfaces;

pub use client::{AugeClient, AugeError};
