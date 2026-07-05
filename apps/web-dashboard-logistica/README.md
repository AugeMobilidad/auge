# web-dashboard-logistica (shell)

Futuro **dashboard web de logística y operaciones** de Auge Movilidad.

Usuarios previstos: despachadores, coordinadores logísticos, personal de
cumplimiento/administración, centro de comando de eventos y gerencia.

## Qué existe hoy

- Este shell de paquete (sin framework elegido todavía).
- Contratos documentados en `src/contracts/README.md`.
- El backend ya expone las queries/mutations con forma de view-model que este
  dashboard consumirá: `convex/appDashboard.ts` (y las fachadas Rust
  equivalentes en `crates/auge_interfaces/src/interfaces/web_dashboard_logistica.rs`).

## Qué NO se debe hacer aquí

- No construir pantallas todavía.
- No consultar tablas de Convex directamente: el dashboard consume únicamente
  las funciones `appDashboard.*` (queries) y las mutations `dashboard*` de
  `accionesOperativas.ts`, que ya validan transiciones y registran auditoría.
- No duplicar lógica de negocio en el frontend.

## Casos de uso que el backend ya soporta

tablero de despacho, disponibilidad de flota y conductores, asignación y
reasignación, control de incidencias, trazabilidad de servicio, cumplimiento
documental, rutas, eventos, comunidades, liquidaciones y analítica operativa.
