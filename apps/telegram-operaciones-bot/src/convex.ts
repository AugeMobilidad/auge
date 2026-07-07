/**
 * Cliente Convex del bot: una única instancia de `ConvexHttpClient`, más un
 * helper para convertir errores de negocio (mutations que lanzan `Error`) en
 * mensajes amigables en español, sin filtrar stack traces al chat.
 *
 * `CONVEX_URL` viene siempre del entorno (nunca hardcoded): en desarrollo
 * apunta al deployment local (`bunx convex dev --local`).
 */
import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = process.env.CONVEX_URL;

if (CONVEX_URL === undefined || CONVEX_URL.trim() === "") {
  throw new Error(
    "Falta la variable de entorno CONVEX_URL (URL del deployment Convex, ej. http://127.0.0.1:3210)",
  );
}

export const convex = new ConvexHttpClient(CONVEX_URL);

/**
 * Extrae un mensaje legible de un error lanzado por una mutation/query de
 * Convex. El backend local propaga el `Error` original con un prefijo tipo
 * "Server Error\nUncaught Error: <mensaje>\n  at ...": nos quedamos solo con
 * `<mensaje>`. Si no reconocemos la forma, devolvemos un mensaje genérico en
 * vez de exponer la traza al usuario.
 */
export function mensajeDeErrorConvex(error: unknown): string {
  const bruto = error instanceof Error ? error.message : String(error);
  const match = /Uncaught Error:\s*(.+)/.exec(bruto);
  if (match?.[1] !== undefined) {
    return match[1].split("\n")[0]?.trim() ?? "Ocurrió un error inesperado.";
  }
  // Algunas mutations lanzan `Error` directo (sin el prefijo de servidor),
  // por ejemplo cuando el cliente HTTP falla antes de llegar al servidor.
  const primeraLinea = bruto.split("\n")[0]?.trim();
  if (primeraLinea !== undefined && primeraLinea.length > 0 && primeraLinea.length < 200) {
    return primeraLinea;
  }
  return "Ocurrió un error inesperado al procesar tu solicitud.";
}
