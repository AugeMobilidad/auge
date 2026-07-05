//! Genera `src/convex_types.rs` desde el esquema y las funciones de Convex.
//!
//! Los tipos Rust de argumentos de funciones Convex NO se escriben a mano:
//! salen de `convex-typegen` leyendo `/convex` (raíz del repo).
use convex_typegen::prelude::*;

fn main() {
    let config = Configuration {
        schema_path: "../../convex/schema.ts".into(),
        convex_dir: "../../convex".into(),
        out_file: "src/convex_types.rs".into(),
        function_paths: Vec::new(),
    };

    println!("cargo:rerun-if-changed={}", config.schema_path.display());
    match rcfp(&config) {
        Ok(paths) => {
            for path in paths {
                println!("cargo:rerun-if-changed={}", path.display());
            }
        }
        Err(e) => panic!("convex-typegen no pudo resolver las funciones: {e}"),
    }

    if let Err(e) = generate(config) {
        panic!("convex-typegen falló: {e}");
    }
}
