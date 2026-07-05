//! Shell del futuro bot de Telegram de Auge Movilidad.
//!
//! TODAVÍA NO hay integración real con Telegram: ni polling, ni webhooks, ni
//! carga de token. Cuando se implemente, el loop del bot:
//!   1. recibirá updates de Telegram,
//!   2. los mapeará a los comandos de `commands::{conductor, operaciones}`,
//!   3. y esos comandos llamarán las fachadas tipadas de `auge_interfaces`
//!      (nunca tablas de Convex directamente).

mod commands;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("telegram-operaciones-bot (shell)");
    println!(
        "Comandos de conductor definidos: {}",
        commands::conductor::COMANDOS.len()
    );
    println!(
        "Comandos de operaciones definidos: {}",
        commands::operaciones::COMANDOS.len()
    );
    println!(
        "Sin integración con la API de Telegram todavía; ver README. \
         CONVEX_URL configurada: {}",
        std::env::var(auge_interfaces::client::CONVEX_URL_ENV).is_ok()
    );
    Ok(())
}
