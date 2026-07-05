/**
 * Seguridad — resolución de contexto de actor y chequeos de autorización.
 *
 * No es auth de producción final: es la frontera mínima que necesitan el
 * dashboard y el bot de Telegram para que la arquitectura no asuma que todos
 * los llamadores son confiables.
 *
 * Reglas base:
 * - Un conductor solo puede actuar sobre servicios que tienen una asignación
 *   suya (propuesta o confirmada).
 * - Despachador/coordinador puede asignar y reasignar servicios.
 * - Cumplimiento/admin puede actualizar documentos.
 * - Finanzas/admin puede aprobar liquidaciones.
 * - Centro de comando de eventos puede inspeccionar operaciones de evento.
 */
import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Permisos
// ---------------------------------------------------------------------------

export const PERMISOS = {
  despachar: "despachar", // asignar/reasignar/cancelar servicios
  gestionarIncidencias: "gestionarIncidencias",
  gestionarDocumentos: "gestionarDocumentos",
  aprobarLiquidaciones: "aprobarLiquidaciones",
  verEventos: "verEventos", // centro de comando
  administrar: "administrar",
} as const;

export type Permiso = (typeof PERMISOS)[keyof typeof PERMISOS];

/** Permisos implícitos por tipo de usuario (los roles agregan más). */
const PERMISOS_POR_TIPO: Record<Doc<"usuariosSistema">["tipoUsuario"], Permiso[]> = {
  operadorLogistico: [PERMISOS.despachar, PERMISOS.gestionarIncidencias],
  coordinador: [PERMISOS.despachar, PERMISOS.gestionarIncidencias, PERMISOS.verEventos],
  conductor: [],
  propietario: [],
  gestor: [],
  cliente: [],
  admin: Object.values(PERMISOS),
  sistema: Object.values(PERMISOS),
};

// ---------------------------------------------------------------------------
// Resolución de actor
// ---------------------------------------------------------------------------

export type ContextoTelegram = {
  cuenta: Doc<"telegramCuentas">;
  conductor: Doc<"conductores"> | null;
  usuario: Doc<"usuariosSistema"> | null;
};

/** Resuelve una cuenta de Telegram vinculada a su conductor/usuario. */
export async function resolverActorTelegram(
  ctx: QueryCtx,
  telegramUserId: string,
): Promise<ContextoTelegram | null> {
  const cuenta = await ctx.db
    .query("telegramCuentas")
    .withIndex("by_telegramUserId", (q) => q.eq("telegramUserId", telegramUserId))
    .unique();
  if (cuenta === null || cuenta.estado !== "vinculada") return null;
  const conductor =
    cuenta.conductorId !== undefined ? await ctx.db.get(cuenta.conductorId) : null;
  const usuario =
    cuenta.usuarioSistemaId !== undefined
      ? await ctx.db.get(cuenta.usuarioSistemaId)
      : null;
  return { cuenta, conductor, usuario };
}

/** Exige un usuario del sistema activo; lanza si no existe o está inactivo. */
export async function requerirUsuarioActivo(
  ctx: QueryCtx,
  usuarioId: Id<"usuariosSistema">,
): Promise<Doc<"usuariosSistema">> {
  const usuario = await ctx.db.get(usuarioId);
  if (usuario === null) throw new Error("Usuario del sistema no encontrado");
  if (usuario.estado !== "activo") {
    throw new Error(`Usuario ${usuario.nombre} no está activo (${usuario.estado})`);
  }
  return usuario;
}

/** Exige un conductor activo; lanza si no existe o no está activo. */
export async function requerirConductorActivo(
  ctx: QueryCtx,
  conductorId: Id<"conductores">,
): Promise<Doc<"conductores">> {
  const conductor = await ctx.db.get(conductorId);
  if (conductor === null) throw new Error("Conductor no encontrado");
  if (conductor.estado !== "activo") {
    throw new Error(`Conductor ${conductor.nombre} no está activo (${conductor.estado})`);
  }
  return conductor;
}

// ---------------------------------------------------------------------------
// Chequeos de autorización
// ---------------------------------------------------------------------------

/** ¿Tiene el usuario este permiso (por tipo o por rol asignado)? */
export async function usuarioTienePermiso(
  ctx: QueryCtx,
  usuario: Doc<"usuariosSistema">,
  permiso: Permiso,
): Promise<boolean> {
  if (PERMISOS_POR_TIPO[usuario.tipoUsuario].includes(permiso)) return true;
  const vinculos = await ctx.db
    .query("usuariosRoles")
    .withIndex("by_usuario_estado", (q) =>
      q.eq("usuarioSistemaId", usuario._id).eq("estado", "activo"),
    )
    .collect();
  for (const vinculo of vinculos) {
    const rol = await ctx.db.get(vinculo.rolSistemaId);
    if (rol !== null && rol.estado === "activo" && rol.permisos.includes(permiso)) {
      return true;
    }
  }
  return false;
}

/** Exige un permiso; lanza si el usuario no lo tiene. */
export async function requerirPermiso(
  ctx: QueryCtx,
  usuarioId: Id<"usuariosSistema">,
  permiso: Permiso,
): Promise<Doc<"usuariosSistema">> {
  const usuario = await requerirUsuarioActivo(ctx, usuarioId);
  if (!(await usuarioTienePermiso(ctx, usuario, permiso))) {
    throw new Error(`Usuario ${usuario.nombre} no tiene el permiso "${permiso}"`);
  }
  return usuario;
}

/**
 * Exige que el servicio tenga una asignación de este conductor en alguno de
 * los estados dados. Es la regla que impide que un conductor vinculado por
 * Telegram toque servicios ajenos.
 */
export async function requerirAsignacionDeConductor(
  ctx: QueryCtx,
  conductorId: Id<"conductores">,
  servicioId: Id<"serviciosTransporte">,
  estados: Array<Doc<"asignacionesServicio">["estado"]> = ["confirmada"],
): Promise<Doc<"asignacionesServicio">> {
  for (const estado of estados) {
    const asignacion = await ctx.db
      .query("asignacionesServicio")
      .withIndex("by_servicio_estado", (q) =>
        q.eq("servicioId", servicioId).eq("estado", estado),
      )
      .collect();
    const propia = asignacion.find((a) => a.conductorId === conductorId);
    if (propia !== undefined) return propia;
  }
  throw new Error("El servicio no tiene una asignación de este conductor");
}

// ---------------------------------------------------------------------------
// Queries públicas de apoyo para las apps
// ---------------------------------------------------------------------------

/** ¿Puede este usuario ejecutar esta acción? Para pre-chequeos de UI. */
export const verificarPermiso = query({
  args: {
    usuarioSistemaId: v.id("usuariosSistema"),
    permiso: v.string(),
  },
  returns: v.object({ permitido: v.boolean(), motivo: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const usuario = await ctx.db.get(args.usuarioSistemaId);
    if (usuario === null) return { permitido: false, motivo: "Usuario no encontrado" };
    if (usuario.estado !== "activo") {
      return { permitido: false, motivo: `Usuario ${usuario.estado}` };
    }
    const permitido = await usuarioTienePermiso(ctx, usuario, args.permiso as Permiso);
    return permitido
      ? { permitido: true }
      : { permitido: false, motivo: `Falta permiso "${args.permiso}"` };
  },
});
