//! Fachada del futuro dashboard web de logística y operaciones.
//!
//! Frontera de interfaz de la app: expone casos de uso del dashboard, no
//! operaciones crudas de tablas. Todas las MUTATIONS de este módulo exigen
//! `actorUsuarioSistemaId` en sus args y Convex verifica el permiso
//! (`despachar`, `gestionarIncidencias`, `gestionarDocumentos`,
//! `aprobarLiquidaciones`) y registra auditoría con origen `webDashboard`.
//! Las queries devuelven view-models listos para render.

use super::fachada;
use crate::convex_types::{
    AccionesoperativasDashboardActualizarDocumentoArgs,
    AccionesoperativasDashboardAprobarLiquidacionArgs,
    AccionesoperativasDashboardAsignarServicioArgs,
    AccionesoperativasDashboardCancelarServicioArgs,
    AccionesoperativasDashboardCrearServicioArgs,
    AccionesoperativasDashboardProgramarMantenimientoArgs,
    AccionesoperativasDashboardReemplazarAsignacionArgs,
    AccionesoperativasDashboardResolverIncidenciaArgs, AppdashboardDashboardCumplimientoArgs,
    AppdashboardDashboardDetalleServicioArgs, AppdashboardDashboardEventosArgs,
    AppdashboardDashboardLiquidacionesArgs, AppdashboardDashboardResumenOperativoArgs,
    AppdashboardDashboardTableroDespachoArgs, OperacionesConductoresDisponiblesArgs,
    OperacionesFlotaDisponibleArgs, OperacionesIncidenciasAbiertasArgs,
    OperacionesServiciosPendientesAsignacionArgs,
};

// --- Paneles (queries con forma de view-model) ---
fachada!(
    /// Resumen operativo del día/rango: estados, incidencias, disponibilidad.
    query resumen_operativo => AppdashboardDashboardResumenOperativoArgs
);
fachada!(
    /// Tablero de despacho: pendientes, asignables y asignaciones del día.
    query tablero_despacho => AppdashboardDashboardTableroDespachoArgs
);
fachada!(
    /// Detalle de servicio para pantalla de inspección.
    query detalle_servicio => AppdashboardDashboardDetalleServicioArgs
);
fachada!(
    /// Panel de cumplimiento: vencidos, por vencer, bloqueados, mantenimiento.
    query panel_cumplimiento => AppdashboardDashboardCumplimientoArgs
);
fachada!(
    /// Panel de eventos: activos, críticas abiertas, coordinadores.
    query panel_eventos => AppdashboardDashboardEventosArgs
);
fachada!(
    /// Panel de liquidaciones: por estado y por beneficiario.
    query panel_liquidaciones => AppdashboardDashboardLiquidacionesArgs
);

// --- Listas de despacho ---
fachada!(
    /// Servicios `programado` sin asignación confirmada.
    query servicios_pendientes_asignacion => OperacionesServiciosPendientesAsignacionArgs
);
fachada!(
    /// Vehículos elegibles para asignar en una ventana horaria.
    query flota_disponible => OperacionesFlotaDisponibleArgs
);
fachada!(
    /// Conductores elegibles para asignar en una ventana horaria.
    query conductores_disponibles => OperacionesConductoresDisponiblesArgs
);
fachada!(
    /// Incidencias abiertas con contexto de servicio/cliente/asignación.
    query incidencias_abiertas => OperacionesIncidenciasAbiertasArgs
);

// --- Acciones del dashboard (exigen actorUsuarioSistemaId + permiso) ---
fachada!(
    /// Crea un servicio (permiso `despachar`).
    mutation crear_servicio => AccionesoperativasDashboardCrearServicioArgs
);
fachada!(
    /// Asigna vehículo+conductor a un servicio (permiso `despachar`).
    mutation asignar_servicio => AccionesoperativasDashboardAsignarServicioArgs
);
fachada!(
    /// Reemplaza la asignación activa con motivo (permiso `despachar`).
    mutation reemplazar_asignacion => AccionesoperativasDashboardReemplazarAsignacionArgs
);
fachada!(
    /// Cancela (o marca fallido) un servicio con motivo (permiso `despachar`).
    mutation cancelar_servicio => AccionesoperativasDashboardCancelarServicioArgs
);
fachada!(
    /// Resuelve/cierra una incidencia (permiso `gestionarIncidencias`).
    mutation resolver_incidencia => AccionesoperativasDashboardResolverIncidenciaArgs
);
fachada!(
    /// Aprueba una liquidación pendiente (permiso `aprobarLiquidaciones`).
    mutation aprobar_liquidacion => AccionesoperativasDashboardAprobarLiquidacionArgs
);
fachada!(
    /// Actualiza el estado de un documento (permiso `gestionarDocumentos`).
    mutation actualizar_documento => AccionesoperativasDashboardActualizarDocumentoArgs
);
fachada!(
    /// Programa un mantenimiento (permiso `gestionarDocumentos`).
    mutation programar_mantenimiento => AccionesoperativasDashboardProgramarMantenimientoArgs
);
