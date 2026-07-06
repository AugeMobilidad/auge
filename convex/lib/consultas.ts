/**
 * Helpers de lectura compartidos entre queries y mutations.
 * Reciben QueryCtx, así que también sirven dentro de mutations.
 */
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { hoyISO } from "./horarios";

/** Primera asignación del servicio en alguno de los estados dados. */
export async function asignacionActivaDeServicio(
  ctx: QueryCtx,
  servicioId: Id<"serviciosTransporte">,
  estados: Array<Doc<"asignacionesServicio">["estado"]>,
): Promise<Doc<"asignacionesServicio"> | null> {
  for (const estado of estados) {
    const encontrada = await ctx.db
      .query("asignacionesServicio")
      .withIndex("by_servicio_estado", (q) =>
        q.eq("servicioId", servicioId).eq("estado", estado),
      )
      .first();
    if (encontrada !== null) return encontrada;
  }
  return null;
}

export type ContextoOperacion = {
  operacion: Doc<"operaciones">;
  programa: Doc<"programasMovilidad"> | null;
  cliente: Doc<"clientes"> | null;
};

/** Operación con su programa y cliente resueltos. */
export async function contextoDeOperacion(
  ctx: QueryCtx,
  operacionId: Id<"operaciones">,
): Promise<ContextoOperacion | null> {
  const operacion = await ctx.db.get(operacionId);
  if (operacion === null) return null;
  const programa = await ctx.db.get(operacion.programaId);
  const cliente = programa !== null ? await ctx.db.get(programa.clienteId) : null;
  return { operacion, programa, cliente };
}

/** Último checklist aprobado (o aprobado con observaciones) del servicio. */
export async function checklistAprobadoDeServicio(
  ctx: QueryCtx,
  servicioId: Id<"serviciosTransporte">,
): Promise<Doc<"checklistsPreoperativos"> | null> {
  const checklists = await ctx.db
    .query("checklistsPreoperativos")
    .withIndex("by_servicio", (q) => q.eq("servicioId", servicioId))
    .collect();
  return (
    checklists
      .filter((c) => c.resultado === "aprobado" || c.resultado === "aprobadoConObservaciones")
      .sort((a, b) => b.fecha - a.fecha)[0] ?? null
  );
}

/** Documentos vencidos / por vencer de una entidad (para resúmenes). */
export async function resumenCumplimientoDeEntidad(
  ctx: QueryCtx,
  campo: "conductorId" | "vehiculoId" | "propietarioId" | "gestorId",
  id: Id<"conductores"> | Id<"vehiculos"> | Id<"propietarios"> | Id<"gestoresValidados">,
): Promise<{ vencidos: number; porVencer: number }> {
  const indice = {
    conductorId: "by_conductor",
    vehiculoId: "by_vehiculo",
    propietarioId: "by_propietario",
    gestorId: "by_gestor",
  } as const;
  const documentos = await ctx.db
    .query("documentosCumplimiento")
    .withIndex(indice[campo], (q) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      q.eq(campo, id as any),
    )
    .collect();
  // El `estado` almacenado puede quedar desactualizado (un doc "vigente" cuya
  // fecha ya pasó); la fecha de vencimiento manda sobre el snapshot.
  const hoy = hoyISO();
  const estaVencido = (d: Doc<"documentosCumplimiento">) =>
    d.estado === "vencido" ||
    (d.fechaVencimiento !== undefined &&
      d.fechaVencimiento < hoy &&
      d.estado !== "rechazado");
  return {
    vencidos: documentos.filter(estaVencido).length,
    porVencer: documentos.filter((d) => d.estado === "porVencer" && !estaVencido(d)).length,
  };
}
