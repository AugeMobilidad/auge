//! Portal del propietario: utilización de sus vehículos, estado documental,
//! historia de servicios y liquidaciones. Solo lectura.

use super::fachada;
use crate::convex_types::{
    AnalisisFlotaConBajaUtilizacionArgs, OperacionesDocumentosPorVencerArgs,
    OperacionesLiquidacionPorPropietarioArgs, OperacionesTrazabilidadServicioArgs,
};

fachada!(
    /// Liquidaciones del propietario en un rango: ítems, placas y totales.
    query liquidaciones => OperacionesLiquidacionPorPropietarioArgs
);
fachada!(
    /// Documentos por vencer (incluye los de sus vehículos).
    query documentos_por_vencer => OperacionesDocumentosPorVencerArgs
);
fachada!(
    /// Vehículos con baja utilización en un rango (señal de ingreso perdido).
    query utilizacion_vehiculos => AnalisisFlotaConBajaUtilizacionArgs
);
fachada!(
    /// Historia operativa de un servicio donde participó su vehículo.
    query historia_servicio => OperacionesTrazabilidadServicioArgs
);
