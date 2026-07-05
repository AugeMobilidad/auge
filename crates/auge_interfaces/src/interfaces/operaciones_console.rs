//! Consola de operaciones (capa de datos): despacho, asignación, ciclo de
//! vida del servicio e incidencias. Estas funciones envuelven las mutations
//! de capa de datos (actor `sistema`); para acciones con identidad de usuario
//! del dashboard use `web_dashboard_logistica`.

use super::fachada;
use crate::convex_types::{
    AccionesoperativasAsignarVehiculoYConductorArgs, AccionesoperativasCerrarServicioArgs,
    AccionesoperativasConvertirSolicitudEnOperacionOServicioArgs,
    AccionesoperativasCrearOperacionArgs, AccionesoperativasCrearParadaArgs,
    AccionesoperativasCrearRutaArgs, AccionesoperativasIniciarServicioArgs,
    AccionesoperativasProgramarServicioArgs, AccionesoperativasReemplazarAsignacionArgs,
    AccionesoperativasRegistrarIncidenciaArgs, AccionesoperativasResolverIncidenciaArgs,
    OperacionesConductoresDisponiblesArgs, OperacionesEstadoOperacionArgs,
    OperacionesFlotaDisponibleArgs, OperacionesIncidenciasAbiertasArgs,
    OperacionesServiciosPendientesAsignacionArgs, OperacionesTrazabilidadServicioArgs,
};

// --- Lectura de despacho ---
fachada!(
    /// Servicios en `programado` sin asignación confirmada.
    query servicios_pendientes_asignacion => OperacionesServiciosPendientesAsignacionArgs
);
fachada!(
    /// Vehículos habilitados, sin documentos vencidos ni solapes de agenda.
    query flota_disponible => OperacionesFlotaDisponibleArgs
);
fachada!(
    /// Conductores activos con licencia vigente y agenda libre.
    query conductores_disponibles => OperacionesConductoresDisponiblesArgs
);
fachada!(
    /// Historia operativa completa de un servicio.
    query trazabilidad_servicio => OperacionesTrazabilidadServicioArgs
);
fachada!(
    /// Resumen de una operación (estados, incidencias, puntualidad).
    query estado_operacion => OperacionesEstadoOperacionArgs
);
fachada!(
    /// Incidencias abiertas (global o por operación), ordenadas por severidad.
    query incidencias_abiertas => OperacionesIncidenciasAbiertasArgs
);

// --- Planeación ---
fachada!(
    /// Convierte una solicitud validada en operación y/o servicio.
    mutation convertir_solicitud => AccionesoperativasConvertirSolicitudEnOperacionOServicioArgs
);
fachada!(mutation crear_operacion => AccionesoperativasCrearOperacionArgs);
fachada!(mutation crear_ruta => AccionesoperativasCrearRutaArgs);
fachada!(mutation crear_parada => AccionesoperativasCrearParadaArgs);
fachada!(
    /// Programa un servicio bajo una operación abierta (estado `programado`).
    mutation programar_servicio => AccionesoperativasProgramarServicioArgs
);

// --- Despacho y ciclo de vida ---
fachada!(
    /// Propone (o confirma) vehículo+conductor validando cumplimiento y solapes.
    mutation asignar_vehiculo_y_conductor => AccionesoperativasAsignarVehiculoYConductorArgs
);
fachada!(
    /// Reemplaza la asignación activa preservando la historia (motivo requerido).
    mutation reemplazar_asignacion => AccionesoperativasReemplazarAsignacionArgs
);
fachada!(
    /// Inicia un servicio `enPreparacion` con checklist aprobado.
    mutation iniciar_servicio => AccionesoperativasIniciarServicioArgs
);
fachada!(
    /// Completa un servicio `enCurso` (exige evidencia o nota de cierre).
    mutation cerrar_servicio => AccionesoperativasCerrarServicioArgs
);
fachada!(mutation registrar_incidencia => AccionesoperativasRegistrarIncidenciaArgs);
fachada!(mutation resolver_incidencia => AccionesoperativasResolverIncidenciaArgs);
