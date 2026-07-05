//! Capa de comandos del bot: nombres de comando, DTOs de entrada y el mapeo
//! hacia las fachadas de `auge_interfaces`.
//!
//! Este módulo NO conoce la API de Telegram. El futuro adaptador (polling o
//! webhook) parseará los mensajes a estos DTOs y llamará estas funciones.

// Shell compilable: los handlers quedan sin invocar hasta que exista el
// adaptador de Telegram.
#![allow(dead_code)]

pub mod conductor;
pub mod operaciones;

/// Identidad de quien envía el comando, tal como llega del chat.
/// Convex resuelve la cuenta vinculada a partir del `telegram_user_id`.
#[derive(Debug, Clone)]
pub struct ContextoChat {
    pub telegram_user_id: String,
    pub telegram_chat_id: String,
}

/// Descriptor de un comando del bot para armar menús y ayuda.
#[derive(Debug, Clone, Copy)]
pub struct DescriptorComando {
    pub comando: &'static str,
    pub descripcion: &'static str,
}
