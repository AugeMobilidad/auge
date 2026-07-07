# @auge/telegram-operaciones-bot

Bot de Telegram de Auge Movilidad (GramIO + Bun). Atiende principalmente
conductores (servicios del día, checklist, evidencias, incidencias, GPS) y
comandos ligeros de coordinadores. Consume la fachada `appTelegram` de Convex
y las mutations públicas `conductor*` / `vincular*CuentaTelegram`; la
identidad SIEMPRE es el `telegramUserId` del mensaje — el bot nunca envía ids
de conductor elegidos por el cliente.

## Variables de entorno

| Variable | Descripción |
|---|---|
| `BOT_TOKEN` | Token del bot emitido por @BotFather |
| `CONVEX_URL` | URL del deployment Convex (local en desarrollo) |

## Correr en desarrollo

```sh
# Convex local corriendo aparte: bunx convex dev --local
BOT_TOKEN=... CONVEX_URL=... bun run dev   # long-polling con --watch
bun run typecheck
```

## Flujo de vinculación

1. El conductor/coordinador envía `/vincular`: la cuenta queda en estado
   `pendienteVerificacion` (el bot nunca la auto-asocia a un conductor).
2. Operaciones la asocia al conductor o usuario del sistema desde el backend.
3. Una cuenta ya `vinculada` no se re-apunta por esta vía: primero
   `/desvincular`.

## Comandos

- `/start` — saludo según cuenta vinculada y rol.
- `/vincular` · `/desvincular` — gestión de la cuenta.
- `/misservicios` — servicios de hoy/próximos con botón de detalle.
- Detalle de servicio — teclado inline armado desde `accionesPermitidas`:
  confirmar/rechazar asignación, checklist preoperativo, iniciar, reportar
  ubicación (mensaje de ubicación), registrar evidencia (foto), reportar
  incidencia y cerrar servicio.
- `/incidencia` — abrir incidencia sobre el servicio activo.
- Coordinadores: `/incidencias` (abiertas) y `/operacion` (estado corto).

Los errores de negocio de Convex (transiciones inválidas, permisos) llegan al
chat como mensajes amigables en español, nunca como trazas.
