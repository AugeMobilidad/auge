/**
 * Auditoría — registro y consulta de transiciones de estado importantes.
 *
 * `registrarAuditoria` es el helper compartido que usan todas las mutations
 * de `accionesOperativas.ts`; las queries de este módulo permiten inspeccionar
 * el rastro por entidad, por actor o por app de origen.
 */
import { v } from "convex/values";
import { query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { doc } from "./lib/validators";

const auditoriaDoc = doc("auditoriaAcciones");

export type ActorAuditoria = {
  actorTipo: "usuario" | "conductor" | "sistema" | "telegram" | "dashboard";
  actorId?: string;
  origen: "convex" | "rustInterface" | "webDashboard" | "telegramBot" | "sistema";
};

export async function registrarAuditoria(
  ctx: MutationCtx,
  actor: ActorAuditoria,
  entrada: {
    accion: string;
    entidadTipo: string;
    entidadId?: string;
    resultado: "ok" | "error" | "rechazado";
    detalle?: string;
  },
) {
  await ctx.db.insert("auditoriaAcciones", {
    actorTipo: actor.actorTipo,
    actorId: actor.actorId,
    accion: entrada.accion,
    entidadTipo: entrada.entidadTipo,
    entidadId: entrada.entidadId,
    timestamp: Date.now(),
    origen: actor.origen,
    resultado: entrada.resultado,
    detalle: entrada.detalle,
  });
}

/** Rastro de auditoría de una entidad (más reciente primero). */
export const rastroDeEntidad = query({
  args: {
    entidadTipo: v.string(),
    entidadId: v.string(),
    limite: v.optional(v.number()),
  },
  returns: v.array(auditoriaDoc),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("auditoriaAcciones")
      .withIndex("by_entidad_timestamp", (q) =>
        q.eq("entidadTipo", args.entidadTipo).eq("entidadId", args.entidadId),
      )
      .order("desc")
      .take(args.limite ?? 50);
  },
});

/** Acciones recientes de un actor (más reciente primero). */
export const accionesDeActor = query({
  args: {
    actorTipo: v.union(
      v.literal("usuario"),
      v.literal("conductor"),
      v.literal("sistema"),
      v.literal("telegram"),
      v.literal("dashboard"),
    ),
    actorId: v.string(),
    limite: v.optional(v.number()),
  },
  returns: v.array(auditoriaDoc),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("auditoriaAcciones")
      .withIndex("by_actor_timestamp", (q) =>
        q.eq("actorTipo", args.actorTipo).eq("actorId", args.actorId),
      )
      .order("desc")
      .take(args.limite ?? 50);
  },
});

/** Acciones recientes por app de origen (dashboard, bot, etc.). */
export const accionesPorOrigen = query({
  args: {
    origen: v.union(
      v.literal("convex"),
      v.literal("rustInterface"),
      v.literal("webDashboard"),
      v.literal("telegramBot"),
      v.literal("sistema"),
    ),
    limite: v.optional(v.number()),
  },
  returns: v.array(auditoriaDoc),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("auditoriaAcciones")
      .withIndex("by_origen_timestamp", (q) => q.eq("origen", args.origen))
      .order("desc")
      .take(args.limite ?? 100);
  },
});
