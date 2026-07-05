//! Cumplimiento/administración: documentos, vencimientos, mantenimientos y
//! bloqueos operativos. Las escrituras de capa de datos usan actor `sistema`;
//! desde el dashboard use las variantes con identidad de
//! `web_dashboard_logistica`.

use super::fachada;
use crate::convex_types::{
    AccionesoperativasActualizarEstadoDocumentoArgs,
    AccionesoperativasRegistrarDocumentoCumplimientoArgs,
    AccionesoperativasRegistrarMantenimientoArgs, AnalisisDocumentosCriticosVencidosArgs,
    AppdashboardDashboardCumplimientoArgs, OperacionesDocumentosPorVencerArgs,
};

fachada!(
    /// Documentos que vencen en los próximos N días, con entidad legible.
    query documentos_por_vencer => OperacionesDocumentosPorVencerArgs
);
fachada!(
    /// Entidades ACTIVAS con documentos vencidos que bloquean operación.
    query documentos_criticos_vencidos => AnalisisDocumentosCriticosVencidosArgs
);
fachada!(
    /// Panel completo: vencidos, por vencer, bloqueados y mantenimientos.
    query panel_cumplimiento => AppdashboardDashboardCumplimientoArgs
);
fachada!(
    /// Registra un documento (estado calculado según vencimiento).
    mutation registrar_documento => AccionesoperativasRegistrarDocumentoCumplimientoArgs
);
fachada!(
    /// Cambia el estado de un documento (verificación/vencimiento/rechazo).
    mutation actualizar_estado_documento => AccionesoperativasActualizarEstadoDocumentoArgs
);
fachada!(
    /// Programa un mantenimiento (opcionalmente bloquea el vehículo).
    mutation registrar_mantenimiento => AccionesoperativasRegistrarMantenimientoArgs
);
