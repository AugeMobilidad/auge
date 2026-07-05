//! Gestor validado: gestión de su flota/conductores (links históricos),
//! revisión de asignaciones y control de su propio desempeño. El gestor
//! permanece activo solo mientras su desempeño sea aceptable.

use super::fachada;
use crate::convex_types::{
    AccionesoperativasDesvincularConductorDeGestorArgs,
    AccionesoperativasDesvincularVehiculoDeGestorArgs,
    AccionesoperativasVincularConductorAGestorArgs,
    AccionesoperativasVincularVehiculoAGestorArgs, AnalisisGestoresConDesempenoDeficienteArgs,
    OperacionesEstadoOperacionArgs, OperacionesIncidenciasAbiertasArgs,
    OperacionesTrazabilidadServicioArgs,
};

// --- Flota y conductores (links históricos, nunca se sobrescriben) ---
fachada!(
    /// Incorpora un vehículo a la flota activa del gestor.
    mutation vincular_vehiculo => AccionesoperativasVincularVehiculoAGestorArgs
);
fachada!(
    /// Retira un vehículo de la flota (cierra el link con fechaHasta).
    mutation desvincular_vehiculo => AccionesoperativasDesvincularVehiculoDeGestorArgs
);
fachada!(
    /// Vincula un conductor al gestor.
    mutation vincular_conductor => AccionesoperativasVincularConductorAGestorArgs
);
fachada!(
    /// Desvincula un conductor (cierra el link con fechaHasta).
    mutation desvincular_conductor => AccionesoperativasDesvincularConductorDeGestorArgs
);

// --- Desempeño y revisión ---
fachada!(
    /// Agregado de desempeño de gestores (incidencias, reemplazos, ratio).
    query desempeno_gestores => AnalisisGestoresConDesempenoDeficienteArgs
);
fachada!(
    /// Estado de una operación donde participa su flota.
    query estado_operacion => OperacionesEstadoOperacionArgs
);
fachada!(
    /// Incidencias abiertas de una operación de su flota.
    query incidencias_abiertas => OperacionesIncidenciasAbiertasArgs
);
fachada!(
    /// Revisión de la asignación e historia de un servicio de su flota.
    query revisar_servicio => OperacionesTrazabilidadServicioArgs
);
