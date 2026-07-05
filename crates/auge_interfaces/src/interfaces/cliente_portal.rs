//! Portal del cliente: crear solicitudes, ver estado de su servicio/operación
//! y leer reportes. Solo lectura + registro de solicitudes; nunca despacho.

use super::fachada;
use crate::convex_types::{
    AccionesoperativasRegistrarSolicitudServicioArgs, AnalisisPuntualidadVerificableArgs,
    OperacionesEstadoOperacionArgs, OperacionesOcupacionRutaArgs,
    OperacionesTrazabilidadServicioArgs,
};

fachada!(
    /// Registra una solicitud de servicio (estado inicial `recibida`).
    mutation crear_solicitud => AccionesoperativasRegistrarSolicitudServicioArgs
);
fachada!(
    /// Historia operativa completa de un servicio del cliente.
    query estado_servicio => OperacionesTrazabilidadServicioArgs
);
fachada!(
    /// Resumen de la operación contratada (servicios por estado, incidencias).
    query estado_operacion => OperacionesEstadoOperacionArgs
);
fachada!(
    /// Reporte de puntualidad verificable (GPS/evidencias) en un rango.
    query reporte_puntualidad => AnalisisPuntualidadVerificableArgs
);
fachada!(
    /// Ocupación de una ruta contratada en un rango de fechas.
    query reporte_ocupacion_ruta => OperacionesOcupacionRutaArgs
);
