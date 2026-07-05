/**
 * Queries con forma corta para el futuro bot de Telegram.
 *
 * El bot atiende principalmente conductores (y comandos ligeros de
 * coordinadores). Todas las queries resuelven la identidad a partir del
 * telegramUserId (o de un conductorId ya resuelto) y solo devuelven datos del
 * propio conductor. Devuelven null / listas vacías en vez de lanzar, para que
 * el bot pueda responder con mensajes amigables.
 *
 * Las escrituras del bot son las mutations `conductor*` y
 * `vincular/desvincularCuentaTelegram` de `accionesOperativas.ts`.
 */
import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { resolverActorTelegram } from "./seguridad";
import {
  asignacionActivaDeServicio,
  checklistAprobadoDeServicio,
  contextoDeOperacion,
} from "./lib/consultas";
import { hoyISO } from "./lib/horarios";

// ---------------------------------------------------------------------------
// Identidad
// ---------------------------------------------------------------------------

export const telegramResolverCuenta = query({
  args: { telegramUserId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      cuentaId: v.id("telegramCuentas"),
      estado: v.string(),
      conductorId: v.optional(v.id("conductores")),
      conductorNombre: v.optional(v.string()),
      conductorEstado: v.optional(v.string()),
      usuarioSistemaId: v.optional(v.id("usuariosSistema")),
      usuarioNombre: v.optional(v.string()),
      tipoUsuario: v.optional(v.string()),
      esCoordinador: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const cuenta = await ctx.db
      .query("telegramCuentas")
      .withIndex("by_telegramUserId", (q) => q.eq("telegramUserId", args.telegramUserId))
      .unique();
    if (cuenta === null) return null;
    const conductor =
      cuenta.conductorId !== undefined ? await ctx.db.get(cuenta.conductorId) : null;
    const usuario =
      cuenta.usuarioSistemaId !== undefined
        ? await ctx.db.get(cuenta.usuarioSistemaId)
        : null;
    return {
      cuentaId: cuenta._id,
      estado: cuenta.estado,
      conductorId: conductor?._id,
      conductorNombre: conductor?.nombre,
      conductorEstado: conductor?.estado,
      usuarioSistemaId: usuario?._id,
      usuarioNombre: usuario?.nombre,
      tipoUsuario: usuario?.tipoUsuario,
      esCoordinador:
        usuario !== null &&
        (usuario.tipoUsuario === "coordinador" ||
          usuario.tipoUsuario === "operadorLogistico" ||
          usuario.tipoUsuario === "admin"),
    };
  },
});

async function conductorDesdeIdentidad(
  ctx: QueryCtx,
  args: { telegramUserId?: string; conductorId?: Id<"conductores"> },
): Promise<Doc<"conductores"> | null> {
  if (args.telegramUserId !== undefined) {
    const contexto = await resolverActorTelegram(ctx, args.telegramUserId);
    return contexto?.conductor ?? null;
  }
  if (args.conductorId !== undefined) return await ctx.db.get(args.conductorId);
  return null;
}

const identidadArgs = {
  telegramUserId: v.optional(v.string()),
  conductorId: v.optional(v.id("conductores")),
};

// ---------------------------------------------------------------------------
// Servicios del conductor
// ---------------------------------------------------------------------------

const servicioCortoValidator = v.object({
  servicioId: v.id("serviciosTransporte"),
  asignacionId: v.id("asignacionesServicio"),
  estadoAsignacion: v.string(),
  estadoServicio: v.string(),
  fecha: v.string(),
  hora: v.string(),
  origen: v.string(),
  destino: v.string(),
  vehiculoPlaca: v.string(),
  prioridad: v.string(),
});

export const telegramServiciosDeConductor = query({
  args: identidadArgs,
  returns: v.array(servicioCortoValidator),
  handler: async (ctx, args) => {
    const conductor = await conductorDesdeIdentidad(ctx, args);
    if (conductor === null) return [];
    const hoy = hoyISO();
    const filas = [];
    for (const estado of ["propuesta", "confirmada"] as const) {
      const asignaciones = await ctx.db
        .query("asignacionesServicio")
        .withIndex("by_conductor_estado", (q) =>
          q.eq("conductorId", conductor._id).eq("estado", estado),
        )
        .collect();
      for (const asignacion of asignaciones) {
        const servicio = await ctx.db.get(asignacion.servicioId);
        if (servicio === null) continue;
        if (servicio.fechaProgramada < hoy) continue;
        if (
          servicio.estado === "cancelado" ||
          servicio.estado === "fallido" ||
          servicio.estado === "completado"
        )
          continue;
        const vehiculo = await ctx.db.get(asignacion.vehiculoId);
        filas.push({
          servicioId: servicio._id,
          asignacionId: asignacion._id,
          estadoAsignacion: asignacion.estado,
          estadoServicio: servicio.estado,
          fecha: servicio.fechaProgramada,
          hora: servicio.horaInicioProgramada,
          origen: servicio.origenTexto,
          destino: servicio.destinoTexto,
          vehiculoPlaca: vehiculo?.placa ?? "(?)",
          prioridad: servicio.prioridad,
        });
      }
    }
    return filas.sort((a, b) =>
      `${a.fecha} ${a.hora}` < `${b.fecha} ${b.hora}` ? -1 : 1,
    );
  },
});

// ---------------------------------------------------------------------------
// Detalle de servicio con próximas acciones permitidas
// ---------------------------------------------------------------------------

export const telegramDetalleServicio = query({
  args: {
    ...identidadArgs,
    servicioId: v.id("serviciosTransporte"),
  },
  returns: v.union(
    v.null(),
    v.object({
      servicioId: v.id("serviciosTransporte"),
      estadoServicio: v.string(),
      fecha: v.string(),
      hora: v.string(),
      origen: v.string(),
      destino: v.string(),
      clienteNombre: v.string(),
      operacionNombre: v.string(),
      pasajeros: v.optional(v.number()),
      vehiculoPlaca: v.string(),
      estadoAsignacion: v.string(),
      checklistResultado: v.optional(v.string()),
      accionesPermitidas: v.array(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const conductor = await conductorDesdeIdentidad(ctx, args);
    if (conductor === null) return null;
    const servicio = await ctx.db.get(args.servicioId);
    if (servicio === null) return null;
    // Solo servicios con asignación de este conductor.
    const asignacion = await asignacionActivaDeServicio(ctx, servicio._id, [
      "propuesta",
      "confirmada",
      "completada",
    ]);
    if (asignacion === null || asignacion.conductorId !== conductor._id) return null;
    const vehiculo = await ctx.db.get(asignacion.vehiculoId);
    const contexto = await contextoDeOperacion(ctx, servicio.operacionId);
    const checklist = await checklistAprobadoDeServicio(ctx, servicio._id);

    const acciones: string[] = [];
    if (asignacion.estado === "propuesta") {
      acciones.push("confirmarAsignacion", "rechazarAsignacion");
    } else if (asignacion.estado === "confirmada") {
      switch (servicio.estado) {
        case "asignado":
          acciones.push("enviarChecklist");
          break;
        case "enPreparacion":
          acciones.push(checklist !== null ? "iniciarServicio" : "enviarChecklist");
          break;
        case "enCurso":
          acciones.push(
            "reportarUbicacion",
            "registrarEvidencia",
            "reportarIncidencia",
            "cerrarServicio",
          );
          break;
      }
    }
    return {
      servicioId: servicio._id,
      estadoServicio: servicio.estado,
      fecha: servicio.fechaProgramada,
      hora: servicio.horaInicioProgramada,
      origen: servicio.origenTexto,
      destino: servicio.destinoTexto,
      clienteNombre: contexto?.cliente?.nombre ?? "(sin cliente)",
      operacionNombre: contexto?.operacion.nombre ?? "(sin operación)",
      pasajeros: servicio.cantidadPasajerosProgramada,
      vehiculoPlaca: vehiculo?.placa ?? "(?)",
      estadoAsignacion: asignacion.estado,
      checklistResultado: checklist?.resultado,
      accionesPermitidas: acciones,
    };
  },
});

// ---------------------------------------------------------------------------
// Incidencias y estado de operación
// ---------------------------------------------------------------------------

export const telegramIncidenciasAbiertas = query({
  args: identidadArgs,
  returns: v.array(
    v.object({
      incidenciaId: v.id("incidencias"),
      servicioId: v.id("serviciosTransporte"),
      tipo: v.string(),
      severidad: v.string(),
      estado: v.string(),
      descripcion: v.string(),
      timestamp: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    // Con identidad de conductor: solo incidencias de sus servicios.
    const conductor = await conductorDesdeIdentidad(ctx, args);
    const filas = [];
    if (conductor !== null) {
      for (const estadoAsignacion of ["confirmada", "completada"] as const) {
        const asignaciones = await ctx.db
          .query("asignacionesServicio")
          .withIndex("by_conductor_estado", (q) =>
            q.eq("conductorId", conductor._id).eq("estado", estadoAsignacion),
          )
          .collect();
        for (const asignacion of asignaciones) {
          const incidencias = await ctx.db
            .query("incidencias")
            .withIndex("by_servicio", (q) => q.eq("servicioId", asignacion.servicioId))
            .collect();
          for (const incidencia of incidencias) {
            if (incidencia.estado !== "abierta" && incidencia.estado !== "enGestion") continue;
            filas.push(incidencia);
          }
        }
      }
    } else if (args.telegramUserId !== undefined) {
      // Coordinador vinculado sin conductor: incidencias abiertas globales.
      const cuenta = await ctx.db
        .query("telegramCuentas")
        .withIndex("by_telegramUserId", (q) => q.eq("telegramUserId", args.telegramUserId!))
        .unique();
      const usuario =
        cuenta?.usuarioSistemaId !== undefined
          ? await ctx.db.get(cuenta.usuarioSistemaId)
          : null;
      const esCoordinador =
        usuario !== null &&
        (usuario.tipoUsuario === "coordinador" ||
          usuario.tipoUsuario === "operadorLogistico" ||
          usuario.tipoUsuario === "admin");
      if (esCoordinador) {
        for (const estado of ["abierta", "enGestion"] as const) {
          const grupo = await ctx.db
            .query("incidencias")
            .withIndex("by_estado_timestamp", (q) => q.eq("estado", estado))
            .order("desc")
            .take(20);
          filas.push(...grupo);
        }
      }
    }
    return filas.map((i) => ({
      incidenciaId: i._id,
      servicioId: i.servicioId,
      tipo: i.tipo,
      severidad: i.severidad,
      estado: i.estado,
      descripcion: i.descripcion,
      timestamp: i.timestamp,
    }));
  },
});

export const telegramEstadoOperacion = query({
  args: {
    telegramUserId: v.string(),
    operacionId: v.id("operaciones"),
  },
  returns: v.union(
    v.null(),
    v.object({
      operacionNombre: v.string(),
      estado: v.string(),
      serviciosHoy: v.number(),
      enCurso: v.number(),
      completadosHoy: v.number(),
      incidenciasAbiertas: v.number(),
      incidenciasCriticas: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    // Solo coordinadores/operadores vinculados pueden ver estado de operación.
    const cuenta = await ctx.db
      .query("telegramCuentas")
      .withIndex("by_telegramUserId", (q) => q.eq("telegramUserId", args.telegramUserId))
      .unique();
    if (cuenta === null || cuenta.estado !== "vinculada") return null;
    const usuario =
      cuenta.usuarioSistemaId !== undefined
        ? await ctx.db.get(cuenta.usuarioSistemaId)
        : null;
    const autorizado =
      usuario !== null &&
      (usuario.tipoUsuario === "coordinador" ||
        usuario.tipoUsuario === "operadorLogistico" ||
        usuario.tipoUsuario === "admin");
    if (!autorizado) return null;

    const operacion = await ctx.db.get(args.operacionId);
    if (operacion === null) return null;
    const hoy = hoyISO();
    let serviciosHoy = 0;
    let enCurso = 0;
    let completadosHoy = 0;
    for (const estado of [
      "programado",
      "asignado",
      "enPreparacion",
      "enCurso",
      "completado",
    ] as const) {
      const grupo = await ctx.db
        .query("serviciosTransporte")
        .withIndex("by_operacion_estado_fecha", (q) =>
          q.eq("operacionId", args.operacionId).eq("estado", estado).eq("fechaProgramada", hoy),
        )
        .collect();
      serviciosHoy += grupo.length;
      if (estado === "enCurso") enCurso = grupo.length;
      if (estado === "completado") completadosHoy = grupo.length;
    }
    let abiertas = 0;
    let criticas = 0;
    for (const estado of ["abierta", "enGestion"] as const) {
      const grupo = await ctx.db
        .query("incidencias")
        .withIndex("by_operacion_estado_severidad", (q) =>
          q.eq("operacionId", args.operacionId).eq("estado", estado),
        )
        .collect();
      abiertas += grupo.length;
      criticas += grupo.filter((i) => i.severidad === "critica").length;
    }
    return {
      operacionNombre: operacion.nombre,
      estado: operacion.estado,
      serviciosHoy,
      enCurso,
      completadosHoy,
      incidenciasAbiertas: abiertas,
      incidenciasCriticas: criticas,
    };
  },
});
