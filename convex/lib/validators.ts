/**
 * Helpers de validadores compartidos: documentos completos (campos de tabla +
 * campos de sistema) para usar en `returns:` sin duplicar el esquema a mano.
 */
import { v, type Validator } from "convex/values";
import schema from "../schema";

type TableNames = keyof typeof schema.tables & string;

/** Validador del documento completo de una tabla (incluye _id y _creationTime). */
export function doc<T extends TableNames>(tabla: T) {
  const tableDef = schema.tables[tabla] as { validator: Validator<any, any, any> };
  const fields = (tableDef.validator as { fields?: Record<string, Validator<any, any, any>> })
    .fields;
  if (fields === undefined) {
    throw new Error(`La tabla ${tabla} no tiene un validador de objeto`);
  }
  return v.object({
    ...fields,
    _id: v.id(tabla),
    _creationTime: v.number(),
  });
}
