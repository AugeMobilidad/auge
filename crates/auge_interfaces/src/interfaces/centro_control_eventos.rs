//! Centro de control de eventos: resumen de comando, incidencias críticas y
//! seguimiento de servicios de movilidad de grandes eventos.

use super::fachada;
use crate::convex_types::{
    AppdashboardDashboardEventosArgs, OperacionesControlEventoArgs,
    OperacionesEstadoOperacionArgs, OperacionesIncidenciasAbiertasArgs,
    OperacionesTrazabilidadServicioArgs,
};

fachada!(
    /// Tablero de comando de un evento: servicios por estado, incidencias
    /// críticas abiertas, participantes y últimas evidencias.
    query control_evento => OperacionesControlEventoArgs
);
fachada!(
    /// Eventos activos con servicios en curso y críticas abiertas.
    query eventos_activos => AppdashboardDashboardEventosArgs
);
fachada!(
    /// Incidencias abiertas de una operación del evento (por severidad).
    query incidencias_criticas => OperacionesIncidenciasAbiertasArgs
);
fachada!(
    /// Estado de una operación del evento.
    query estado_operacion => OperacionesEstadoOperacionArgs
);
fachada!(
    /// Seguimiento completo de un servicio del evento (GPS, evidencias).
    query seguimiento_servicio => OperacionesTrazabilidadServicioArgs
);
