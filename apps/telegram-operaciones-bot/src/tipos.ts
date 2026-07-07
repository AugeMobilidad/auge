/**
 * Punto único de acceso a los tipos/API generados por Convex.
 *
 * Todo el resto del bot importa `api`, `Id`, `Doc` desde este módulo en vez
 * de apuntar directamente a `convex/_generated/...` con rutas relativas
 * repetidas por todo el árbol de `src/`.
 */
export { api } from "../../../convex/_generated/api";
export type { Id, Doc } from "../../../convex/_generated/dataModel";
