/**
 * `noUncheckedIndexedAccess` hace que `RegExpMatchArray[i]` sea
 * `string | undefined`. Nuestros patrones de `callback_data` siempre
 * garantizan que el grupo exista si el regex matcheó; este helper evita
 * repetir el chequeo en cada handler.
 */
export function grupoCapturado(match: RegExpMatchArray, indice: number): string {
  const valor = match[indice];
  if (valor === undefined) {
    throw new Error("No se pudo interpretar la acción del botón");
  }
  return valor;
}
