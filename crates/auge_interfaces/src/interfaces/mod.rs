//! Fachadas tipadas por perfil de usuario.
//!
//! Cada módulo es una frontera de interfaz: nombres estables de negocio,
//! argumentos tipados (generados por convex-typegen) y cero preocupaciones de
//! UI o de la API de Telegram. Los módulos `web_dashboard_logistica` y
//! `telegram_operaciones_bot` son las fachadas específicas de las dos apps.

pub mod centro_control_eventos;
pub mod cliente_portal;
pub mod conductor_app;
pub mod cumplimiento_admin;
pub mod gestor_validado;
pub mod operaciones_console;
pub mod propietario_portal;
pub mod telegram_operaciones_bot;
pub mod web_dashboard_logistica;
