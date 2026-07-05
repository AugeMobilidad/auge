# telegram-operaciones-bot (shell)

Futuro **bot de Telegram** de Auge Movilidad, principalmente para
conductores, con comandos operativos ligeros para coordinadores.

## Qué existe hoy

- Crate binario compilable (`cargo build -p telegram-operaciones-bot`).
- Capa de comandos en `src/commands/`:
  - `conductor.rs`: /start, /misservicios, /servicio, /confirmar, /rechazar,
    /checklist, /iniciar, /ubicacion, /evidencia, /incidencia, /cerrar,
    /pendientes — con DTOs de entrada y handlers que llaman la fachada
    `auge_interfaces::interfaces::telegram_operaciones_bot`.
  - `operaciones.rs`: /operacion, /incidencias para coordinadores.
- Los handlers son reales y tipados; lo único que falta es el adaptador de
  Telegram que los invoque.

## Qué NO existe todavía (a propósito)

- Conexión a la API de Telegram: sin polling, sin webhooks, sin token.
- Formateo de mensajes/teclados del chat.

## Reglas al implementarlo

1. El adaptador solo parsea updates → DTOs y llama los handlers; la lógica de
   negocio vive en Convex y las fronteras tipadas en `auge_interfaces`.
2. La identidad viaja como `telegram_user_id`; Convex resuelve la cuenta
   vinculada (`telegramCuentas`) y garantiza que un conductor solo actúe sobre
   sus propios servicios.
3. `CONVEX_URL` viene del entorno (deployment local en desarrollo:
   `bunx convex dev --local`).
4. Registrar `actualizar_ultimo_comando` en cada update para telemetría.
