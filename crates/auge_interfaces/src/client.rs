//! Cliente Convex compartido por todas las interfaces.
//!
//! El deployment es local en desarrollo (`bunx convex dev --local`), así que
//! la URL SIEMPRE viene del entorno (`CONVEX_URL`); nunca se codifica.

use std::collections::BTreeMap;

use convex::{ConvexClient, FunctionResult};
use convex_typegen::prelude::{ConvexClientExt, ConvexValueExt};
use convex_typegen::serde_json::Value as JsonValue;

/// Variable de entorno con la URL del deployment Convex.
pub const CONVEX_URL_ENV: &str = "CONVEX_URL";

#[derive(Debug, thiserror::Error)]
pub enum AugeError {
    #[error("falta la variable de entorno {CONVEX_URL_ENV}")]
    FaltaConvexUrl,
    #[error("error de conexión con Convex: {0}")]
    Conexion(#[from] anyhow::Error),
    #[error("error de serialización de argumentos: {0}")]
    Argumentos(#[from] convex_typegen::serde_json::Error),
    /// La función Convex lanzó un error de negocio (transición inválida,
    /// permiso faltante, asignación ajena, etc.).
    #[error("la función Convex rechazó la llamada: {0}")]
    Rechazo(String),
}

pub type AugeResult<T> = Result<T, AugeError>;

/// Envoltura del [`ConvexClient`] oficial con el contrato de errores de Auge.
///
/// Las fachadas de `interfaces::*` llaman [`Self::query_tipada`] /
/// [`Self::mutation_tipada`] con los structs de argumentos generados por
/// `convex-typegen` (cada uno trae su `FUNCTION_PATH`).
pub struct AugeClient {
    inner: ConvexClient,
}

impl AugeClient {
    /// Conecta usando `CONVEX_URL` del entorno (deployment local en dev).
    pub async fn conectar_desde_env() -> AugeResult<Self> {
        let url = std::env::var(CONVEX_URL_ENV).map_err(|_| AugeError::FaltaConvexUrl)?;
        Self::conectar(&url).await
    }

    pub async fn conectar(deployment_url: &str) -> AugeResult<Self> {
        Ok(Self {
            inner: ConvexClient::new(deployment_url).await?,
        })
    }

    fn interpretar(resultado: FunctionResult) -> AugeResult<JsonValue> {
        match resultado {
            FunctionResult::Value(valor) => Ok(valor.into_serde_value()),
            FunctionResult::ErrorMessage(mensaje) => Err(AugeError::Rechazo(mensaje)),
            FunctionResult::ConvexError(error) => Err(AugeError::Rechazo(error.message)),
        }
    }

    /// Ejecuta una query usando un struct de argumentos generado.
    pub async fn query_tipada<T>(&mut self, nombre: &str, args: T) -> AugeResult<JsonValue>
    where
        BTreeMap<String, JsonValue>: TryFrom<T, Error = convex_typegen::serde_json::Error>,
    {
        let preparados = <ConvexClient as ConvexClientExt>::prepare_args(args)?;
        let resultado = self.inner.query(nombre, preparados).await?;
        Self::interpretar(resultado)
    }

    /// Ejecuta una mutation usando un struct de argumentos generado.
    pub async fn mutation_tipada<T>(&mut self, nombre: &str, args: T) -> AugeResult<JsonValue>
    where
        BTreeMap<String, JsonValue>: TryFrom<T, Error = convex_typegen::serde_json::Error>,
    {
        let preparados = <ConvexClient as ConvexClientExt>::prepare_args(args)?;
        let resultado = self.inner.mutation(nombre, preparados).await?;
        Self::interpretar(resultado)
    }
}
