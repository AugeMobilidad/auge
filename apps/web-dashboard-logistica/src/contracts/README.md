# Contratos del dashboard

Las pantallas del dashboard deben construirse **contra los contratos
app-facing**, nunca contra tablas crudas:

| Necesidad de pantalla | Contrato |
|---|---|
| Resumen operativo del día | `appDashboard.dashboardResumenOperativo` |
| Tablero de despacho | `appDashboard.dashboardTableroDespacho` |
| Detalle de servicio | `appDashboard.dashboardDetalleServicio` |
| Panel de cumplimiento | `appDashboard.dashboardCumplimiento` |
| Centro de comando de eventos | `appDashboard.dashboardEventos` |
| Panel de liquidaciones | `appDashboard.dashboardLiquidaciones` |
| Crear/asignar/cancelar servicio | mutations `dashboard*` en `accionesOperativas` |
| Analítica / red flags | `analisis.*` |

Reglas:

1. Toda mutation enviada desde el dashboard incluye `actorUsuarioSistemaId`
   (identidad del usuario del sistema) — la auditoría depende de esto.
2. Los resultados ya vienen con forma de view-model (nombres legibles, placas,
   estados, alertas); si una pantalla necesita otra forma, se agrega una query
   nueva en `convex/appDashboard.ts`, no un join en el cliente.
3. Si el dashboard se implementa fuera de TypeScript, la fachada equivalente es
   `crates/auge_interfaces::interfaces::web_dashboard_logistica`.
