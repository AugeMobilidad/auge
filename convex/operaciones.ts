/**
 * Queries de negocio — resultados con forma interpretable, no blobs crudos.
 *
 * Cada query devuelve nombres legibles (cliente, operación, placa, conductor)
 * junto a los ids, para que despachadores, controladores y clientes puedan
 * inspeccionar la operación sin unir tablas a mano.
 */
import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  asignacionActivaDeServicio,
  checklistAprobadoDeServicio,
  contextoDeOperacion,
  resumenCumplimientoDeEntidad,
} from "./lib/consultas";
import {
  hoyISO,
  inicioProgramadoMs,
  sumarDiasISO,
  ventanaDeServicio,
  ventanasSeSolapan,
} from "./lib/horarios";

const TOLERANCIA_PUNTUALIDAD_MS = 10 * 60_000;

// ---------------------------------------------------------------------------
// Validadores de forma compartidos
// ---------------------------------------------------------------------------

const resumenPorEstadoValidator = v.object({
  programado: v.number(),
  asignado: v.number(),
  enPreparacion: v.number(),
  enCurso: v.number(),
  completado: v.number(),
  cancelado: v.number(),
  fallido: v.number(),
});

function resumenPorEstado(servicios: Array<Doc<"serviciosTransporte">>) {
  const resumen = {
    programado: 0,
    asignado: 0,
    enPreparacion: 0,
    enCurso: 0,
    completado: 0,
    cancelado: 0,
    fallido: 0,
  };
  for (const servicio of servicios) resumen[servicio.estado] += 1;
  return resumen;
}

async function serviciosDeOperacion(
  ctx: QueryCtx,
  operacionId: Id<"operaciones">,
): Promise<Array<Doc<"serviciosTransporte">>> {
  return await ctx.db
    .query("serviciosTransporte")
    .withIndex("by_operacion", (q) => q.eq("operacionId", operacionId))
    .collect();
}

/** ¿Inició a tiempo? true/false, o null si no hay hito de inicio. */
async function inicioATiempo(
  ctx: QueryCtx,
  servicio: Doc<"serviciosTransporte">,
): Promise<boolean | null> {
  const hitos = await ctx.db
    .query("seguimientosGps")
    .withIndex("by_servicio_timestamp", (q) => q.eq("servicioId", servicio._id))
    .collect();
  const inicio = hitos.find((h) => h.evento === "inicio");
  if (inicio === undefined) return null;
  return inicio.timestamp <= inicioProgramadoMs(servicio) + TOLERANCIA_PUNTUALIDAD_MS;
}

// ---------------------------------------------------------------------------
// Despacho
// ---------------------------------------------------------------------------

export const serviciosPendientesAsignacion = query({
  args: { fecha: v.optional(v.string()) },
  returns: v.array(
    v.object({
      servicioId: v.id("serviciosTransporte"),
      fechaProgramada: v.string(),
      horaInicioProgramada: v.string(),
      origenTexto: v.string(),
      destinoTexto: v.string(),
      tipoVehiculoRequerido: v.string(),
      prioridad: v.string(),
      clienteNombre: v.string(),
      operacionNombre: v.string(),
      tienePropuestaPendiente: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const programados = await ctx.db
      .query("serviciosTransporte")
      .withIndex("by_estado_fecha", (q) => {
        const base = q.eq("estado", "programado");
        return args.fecha !== undefined ? base.eq("fechaProgramada", args.fecha) : base;
      })
      .take(200);
    const filas = [];
    for (const servicio of programados) {
      const propuesta = await asignacionActivaDeServicio(ctx, servicio._id, ["propuesta"]);
      const contexto = await contextoDeOperacion(ctx, servicio.operacionId);
      filas.push({
        servicioId: servicio._id,
        fechaProgramada: servicio.fechaProgramada,
        horaInicioProgramada: servicio.horaInicioProgramada,
        origenTexto: servicio.origenTexto,
        destinoTexto: servicio.destinoTexto,
        tipoVehiculoRequerido: servicio.tipoVehiculoRequerido,
        prioridad: servicio.prioridad,
        clienteNombre: contexto?.cliente?.nombre ?? "(sin cliente)",
        operacionNombre: contexto?.operacion.nombre ?? "(sin operación)",
        tienePropuestaPendiente: propuesta !== null,
      });
    }
    return filas;
  },
});

/** ¿Tiene el actor (conductor o vehículo) un solape confirmado en la ventana? */
async function tieneSolapeConfirmado(
  ctx: QueryCtx,
  indice: "by_conductor_estado" | "by_vehiculo_estado",
  actorId: Id<"conductores"> | Id<"vehiculos">,
  fecha: string,
  ventana: [number, number],
): Promise<boolean> {
  const campo = indice === "by_conductor_estado" ? "conductorId" : "vehiculoId";
  const confirmadas = await ctx.db
    .query("asignacionesServicio")
    .withIndex(indice, (q) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      q.eq(campo, actorId as any).eq("estado", "confirmada"),
    )
    .collect();
  for (const asignacion of confirmadas) {
    const servicio = await ctx.db.get(asignacion.servicioId);
    if (servicio === null || servicio.fechaProgramada !== fecha) continue;
    if (
      servicio.estado === "cancelado" ||
      servicio.estado === "fallido" ||
      servicio.estado === "completado"
    )
      continue;
    if (ventanasSeSolapan(ventana, ventanaDeServicio(servicio))) return true;
  }
  return false;
}

export const flotaDisponible = query({
  args: {
    fecha: v.string(),
    horaInicio: v.string(),
    horaFin: v.optional(v.string()),
    tipoVehiculo: v.optional(
      v.union(
        v.literal("automovil"),
        v.literal("van"),
        v.literal("buseta"),
        v.literal("bus"),
        v.literal("camioneta"),
        v.literal("otro"),
      ),
    ),
  },
  returns: v.array(
    v.object({
      vehiculoId: v.id("vehiculos"),
      placa: v.string(),
      tipoVehiculo: v.string(),
      marca: v.string(),
      linea: v.string(),
      capacidadPasajeros: v.number(),
      gpsActivo: v.boolean(),
      propietarioNombre: v.string(),
      documentosPorVencer: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const ventana = ventanaDeServicio({
      horaInicioProgramada: args.horaInicio,
      horaFinProgramada: args.horaFin,
    });
    const habilitados =
      args.tipoVehiculo !== undefined
        ? await ctx.db
            .query("vehiculos")
            .withIndex("by_tipo_estado", (q) =>
              q.eq("tipoVehiculo", args.tipoVehiculo!).eq("estado", "habilitado"),
            )
            .collect()
        : await ctx.db
            .query("vehiculos")
            .withIndex("by_estado", (q) => q.eq("estado", "habilitado"))
            .collect();
    const filas = [];
    for (const vehiculo of habilitados) {
      const cumplimiento = await resumenCumplimientoDeEntidad(ctx, "vehiculoId", vehiculo._id);
      if (cumplimiento.vencidos > 0) continue; // bloqueado por documentos
      if (
        await tieneSolapeConfirmado(ctx, "by_vehiculo_estado", vehiculo._id, args.fecha, ventana)
      )
        continue;
      const propietario = await ctx.db.get(vehiculo.propietarioId);
      filas.push({
        vehiculoId: vehiculo._id,
        placa: vehiculo.placa,
        tipoVehiculo: vehiculo.tipoVehiculo,
        marca: vehiculo.marca,
        linea: vehiculo.linea,
        capacidadPasajeros: vehiculo.capacidadPasajeros,
        gpsActivo: vehiculo.gpsActivo,
        propietarioNombre: propietario?.nombre ?? "(sin propietario)",
        documentosPorVencer: cumplimiento.porVencer,
      });
    }
    return filas;
  },
});

export const conductoresDisponibles = query({
  args: {
    fecha: v.string(),
    horaInicio: v.string(),
    horaFin: v.optional(v.string()),
    tipoVehiculo: v.optional(
      v.union(
        v.literal("automovil"),
        v.literal("van"),
        v.literal("buseta"),
        v.literal("bus"),
        v.literal("camioneta"),
        v.literal("otro"),
      ),
    ),
  },
  returns: v.array(
    v.object({
      conductorId: v.id("conductores"),
      nombre: v.string(),
      telefono: v.string(),
      licenciaCategoria: v.string(),
      licenciaVence: v.string(),
      calificacionPromedio: v.optional(v.number()),
      documentosPorVencer: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const ventana = ventanaDeServicio({
      horaInicioProgramada: args.horaInicio,
      horaFinProgramada: args.horaFin,
    });
    const activos = await ctx.db
      .query("conductores")
      .withIndex("by_estado", (q) => q.eq("estado", "activo"))
      .collect();
    const filas = [];
    for (const conductor of activos) {
      if (conductor.licenciaVence < args.fecha) continue;
      const cumplimiento = await resumenCumplimientoDeEntidad(
        ctx,
        "conductorId",
        conductor._id,
      );
      if (cumplimiento.vencidos > 0) continue;
      if (
        await tieneSolapeConfirmado(
          ctx,
          "by_conductor_estado",
          conductor._id,
          args.fecha,
          ventana,
        )
      )
        continue;
      if (args.tipoVehiculo !== undefined) {
        const habilitaciones = await ctx.db
          .query("habilitacionesConductorVehiculo")
          .withIndex("by_conductor_estado", (q) =>
            q.eq("conductorId", conductor._id).eq("estado", "habilitado"),
          )
          .collect();
        let habilitadoParaTipo = false;
        for (const habilitacion of habilitaciones) {
          const vehiculo = await ctx.db.get(habilitacion.vehiculoId);
          if (vehiculo !== null && vehiculo.tipoVehiculo === args.tipoVehiculo) {
            habilitadoParaTipo = true;
            break;
          }
        }
        if (!habilitadoParaTipo) continue;
      }
      filas.push({
        conductorId: conductor._id,
        nombre: conductor.nombre,
        telefono: conductor.telefono,
        licenciaCategoria: conductor.licenciaCategoria,
        licenciaVence: conductor.licenciaVence,
        calificacionPromedio: conductor.calificacionPromedio,
        documentosPorVencer: cumplimiento.porVencer,
      });
    }
    return filas;
  },
});

// ---------------------------------------------------------------------------
// Trazabilidad y control
// ---------------------------------------------------------------------------

export const trazabilidadServicio = query({
  args: { servicioId: v.id("serviciosTransporte") },
  returns: v.union(
    v.null(),
    v.object({
      servicio: v.object({
        servicioId: v.id("serviciosTransporte"),
        estado: v.string(),
        prioridad: v.string(),
        fechaProgramada: v.string(),
        horaInicioProgramada: v.string(),
        horaFinProgramada: v.optional(v.string()),
        origenTexto: v.string(),
        destinoTexto: v.string(),
        cantidadPasajerosProgramada: v.optional(v.number()),
        cantidadPasajerosReal: v.optional(v.number()),
        observaciones: v.optional(v.string()),
      }),
      clienteNombre: v.string(),
      operacionNombre: v.string(),
      asignacion: v.union(
        v.null(),
        v.object({
          estado: v.string(),
          fechaAsignacion: v.number(),
          vehiculoPlaca: v.string(),
          conductorNombre: v.string(),
          conductorTelefono: v.string(),
          gestorNombre: v.optional(v.string()),
        }),
      ),
      checklist: v.union(
        v.null(),
        v.object({
          resultado: v.string(),
          fecha: v.number(),
          observaciones: v.optional(v.string()),
        }),
      ),
      hitosGps: v.array(
        v.object({
          evento: v.string(),
          timestamp: v.number(),
          lat: v.number(),
          lng: v.number(),
          fuente: v.string(),
        }),
      ),
      evidencias: v.array(
        v.object({
          tipo: v.string(),
          descripcion: v.string(),
          archivoUrl: v.optional(v.string()),
          creadoPorTipo: v.string(),
          timestamp: v.number(),
        }),
      ),
      incidencias: v.array(
        v.object({
          tipo: v.string(),
          severidad: v.string(),
          estado: v.string(),
          descripcion: v.string(),
          timestamp: v.number(),
        }),
      ),
      cierre: v.object({
        cerrado: v.boolean(),
        conEvidencia: v.boolean(),
        puntualInicio: v.union(v.boolean(), v.null()),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    const servicio = await ctx.db.get(args.servicioId);
    if (servicio === null) return null;
    const contexto = await contextoDeOperacion(ctx, servicio.operacionId);
    const asignacion = await asignacionActivaDeServicio(ctx, args.servicioId, [
      "confirmada",
      "completada",
      "propuesta",
    ]);
    let asignacionShape = null;
    if (asignacion !== null) {
      const vehiculo = await ctx.db.get(asignacion.vehiculoId);
      const conductor = await ctx.db.get(asignacion.conductorId);
      const gestor =
        asignacion.gestorId !== undefined ? await ctx.db.get(asignacion.gestorId) : null;
      asignacionShape = {
        estado: asignacion.estado,
        fechaAsignacion: asignacion.fechaAsignacion,
        vehiculoPlaca: vehiculo?.placa ?? "(sin placa)",
        conductorNombre: conductor?.nombre ?? "(sin conductor)",
        conductorTelefono: conductor?.telefono ?? "",
        gestorNombre: gestor?.nombre,
      };
    }
    const checklist = await checklistAprobadoDeServicio(ctx, args.servicioId);
    const gps = await ctx.db
      .query("seguimientosGps")
      .withIndex("by_servicio_timestamp", (q) => q.eq("servicioId", args.servicioId))
      .collect();
    const hitos = gps.filter((h) => h.evento !== "ubicacion");
    const evidencias = await ctx.db
      .query("evidenciasServicio")
      .withIndex("by_servicio_timestamp", (q) => q.eq("servicioId", args.servicioId))
      .collect();
    const incidencias = await ctx.db
      .query("incidencias")
      .withIndex("by_servicio", (q) => q.eq("servicioId", args.servicioId))
      .collect();
    return {
      servicio: {
        servicioId: servicio._id,
        estado: servicio.estado,
        prioridad: servicio.prioridad,
        fechaProgramada: servicio.fechaProgramada,
        horaInicioProgramada: servicio.horaInicioProgramada,
        horaFinProgramada: servicio.horaFinProgramada,
        origenTexto: servicio.origenTexto,
        destinoTexto: servicio.destinoTexto,
        cantidadPasajerosProgramada: servicio.cantidadPasajerosProgramada,
        cantidadPasajerosReal: servicio.cantidadPasajerosReal,
        observaciones: servicio.observaciones,
      },
      clienteNombre: contexto?.cliente?.nombre ?? "(sin cliente)",
      operacionNombre: contexto?.operacion.nombre ?? "(sin operación)",
      asignacion: asignacionShape,
      checklist:
        checklist !== null
          ? {
              resultado: checklist.resultado,
              fecha: checklist.fecha,
              observaciones: checklist.observaciones,
            }
          : null,
      hitosGps: hitos.map((h) => ({
        evento: h.evento,
        timestamp: h.timestamp,
        lat: h.lat,
        lng: h.lng,
        fuente: h.fuente,
      })),
      evidencias: evidencias.map((e) => ({
        tipo: e.tipo,
        descripcion: e.descripcion,
        archivoUrl: e.archivoUrl,
        creadoPorTipo: e.creadoPorTipo,
        timestamp: e.timestamp,
      })),
      incidencias: incidencias.map((i) => ({
        tipo: i.tipo,
        severidad: i.severidad,
        estado: i.estado,
        descripcion: i.descripcion,
        timestamp: i.timestamp,
      })),
      cierre: {
        cerrado: servicio.estado === "completado",
        conEvidencia: evidencias.length > 0,
        puntualInicio: await inicioATiempo(ctx, servicio),
      },
    };
  },
});

export const estadoOperacion = query({
  args: { operacionId: v.id("operaciones") },
  returns: v.union(
    v.null(),
    v.object({
      operacionNombre: v.string(),
      clienteNombre: v.string(),
      estado: v.string(),
      tipoOperacion: v.string(),
      nivelControl: v.string(),
      totalServicios: v.number(),
      serviciosPorEstado: resumenPorEstadoValidator,
      incidenciasAbiertas: v.number(),
      incidenciasCriticasAbiertas: v.number(),
      vehiculosConfirmados: v.number(),
      conductoresConfirmados: v.number(),
      puntualidad: v.union(
        v.null(),
        v.object({
          serviciosMedidos: v.number(),
          aTiempo: v.number(),
          porcentaje: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const contexto = await contextoDeOperacion(ctx, args.operacionId);
    if (contexto === null) return null;
    const servicios = await serviciosDeOperacion(ctx, args.operacionId);

    const abiertas = [];
    for (const estado of ["abierta", "enGestion"] as const) {
      const grupo = await ctx.db
        .query("incidencias")
        .withIndex("by_operacion_estado_severidad", (q) =>
          q.eq("operacionId", args.operacionId).eq("estado", estado),
        )
        .collect();
      abiertas.push(...grupo);
    }

    const vehiculos = new Set<string>();
    const conductores = new Set<string>();
    let medidos = 0;
    let aTiempo = 0;
    for (const servicio of servicios) {
      const asignacion = await asignacionActivaDeServicio(ctx, servicio._id, [
        "confirmada",
        "completada",
      ]);
      if (asignacion !== null) {
        vehiculos.add(asignacion.vehiculoId);
        conductores.add(asignacion.conductorId);
      }
      const puntual = await inicioATiempo(ctx, servicio);
      if (puntual !== null) {
        medidos += 1;
        if (puntual) aTiempo += 1;
      }
    }
    return {
      operacionNombre: contexto.operacion.nombre,
      clienteNombre: contexto.cliente?.nombre ?? "(sin cliente)",
      estado: contexto.operacion.estado,
      tipoOperacion: contexto.operacion.tipoOperacion,
      nivelControl: contexto.operacion.nivelControl,
      totalServicios: servicios.length,
      serviciosPorEstado: resumenPorEstado(servicios),
      incidenciasAbiertas: abiertas.length,
      incidenciasCriticasAbiertas: abiertas.filter((i) => i.severidad === "critica").length,
      vehiculosConfirmados: vehiculos.size,
      conductoresConfirmados: conductores.size,
      puntualidad:
        medidos > 0
          ? { serviciosMedidos: medidos, aTiempo, porcentaje: Math.round((aTiempo / medidos) * 100) }
          : null,
    };
  },
});

// ---------------------------------------------------------------------------
// Cumplimiento
// ---------------------------------------------------------------------------

const documentoPorVencerValidator = v.object({
  documentoId: v.id("documentosCumplimiento"),
  entidadTipo: v.string(),
  entidadNombre: v.string(),
  identificacion: v.string(),
  tipoDocumento: v.string(),
  numero: v.optional(v.string()),
  fechaVencimiento: v.string(),
  diasRestantes: v.number(),
  estado: v.string(),
});

async function nombreDeEntidadDocumento(
  ctx: QueryCtx,
  documento: Doc<"documentosCumplimiento">,
): Promise<{ nombre: string; identificacion: string }> {
  switch (documento.entidadTipo) {
    case "conductor": {
      const conductor =
        documento.conductorId !== undefined ? await ctx.db.get(documento.conductorId) : null;
      return { nombre: conductor?.nombre ?? "(?)", identificacion: conductor?.cedula ?? "" };
    }
    case "vehiculo": {
      const vehiculo =
        documento.vehiculoId !== undefined ? await ctx.db.get(documento.vehiculoId) : null;
      return {
        nombre: vehiculo !== null ? `${vehiculo.marca} ${vehiculo.linea}` : "(?)",
        identificacion: vehiculo?.placa ?? "",
      };
    }
    case "propietario": {
      const propietario =
        documento.propietarioId !== undefined
          ? await ctx.db.get(documento.propietarioId)
          : null;
      return {
        nombre: propietario?.nombre ?? "(?)",
        identificacion: propietario?.cedulaONit ?? "",
      };
    }
    case "gestor": {
      const gestor =
        documento.gestorId !== undefined ? await ctx.db.get(documento.gestorId) : null;
      return { nombre: gestor?.nombre ?? "(?)", identificacion: gestor?.cedulaONit ?? "" };
    }
  }
}

export const documentosPorVencer = query({
  args: { dias: v.optional(v.number()) },
  returns: v.array(documentoPorVencerValidator),
  handler: async (ctx, args) => {
    const hoy = hoyISO();
    const limite = sumarDiasISO(hoy, args.dias ?? 30);
    const candidatos = [];
    for (const estado of ["vigente", "porVencer"] as const) {
      const grupo = await ctx.db
        .query("documentosCumplimiento")
        .withIndex("by_estado_vencimiento", (q) =>
          q.eq("estado", estado).gte("fechaVencimiento", hoy).lte("fechaVencimiento", limite),
        )
        .collect();
      candidatos.push(...grupo);
    }
    const filas = [];
    for (const documento of candidatos) {
      if (documento.fechaVencimiento === undefined) continue;
      const entidad = await nombreDeEntidadDocumento(ctx, documento);
      const diasRestantes = Math.ceil(
        (new Date(`${documento.fechaVencimiento}T00:00:00Z`).getTime() -
          new Date(`${hoy}T00:00:00Z`).getTime()) /
          86400_000,
      );
      filas.push({
        documentoId: documento._id,
        entidadTipo: documento.entidadTipo,
        entidadNombre: entidad.nombre,
        identificacion: entidad.identificacion,
        tipoDocumento: documento.tipoDocumento,
        numero: documento.numero,
        fechaVencimiento: documento.fechaVencimiento,
        diasRestantes,
        estado: documento.estado,
      });
    }
    return filas.sort((a, b) => a.diasRestantes - b.diasRestantes);
  },
});

// ---------------------------------------------------------------------------
// Incidencias
// ---------------------------------------------------------------------------

export const incidenciasAbiertas = query({
  args: { operacionId: v.optional(v.id("operaciones")) },
  returns: v.array(
    v.object({
      incidenciaId: v.id("incidencias"),
      tipo: v.string(),
      severidad: v.string(),
      estado: v.string(),
      descripcion: v.string(),
      timestamp: v.number(),
      edadHoras: v.number(),
      servicioId: v.id("serviciosTransporte"),
      servicioFecha: v.string(),
      servicioRuta: v.string(),
      clienteNombre: v.string(),
      operacionNombre: v.string(),
      conductorNombre: v.optional(v.string()),
      vehiculoPlaca: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const abiertas: Array<Doc<"incidencias">> = [];
    for (const estado of ["abierta", "enGestion"] as const) {
      if (args.operacionId !== undefined) {
        const grupo = await ctx.db
          .query("incidencias")
          .withIndex("by_operacion_estado_severidad", (q) =>
            q.eq("operacionId", args.operacionId!).eq("estado", estado),
          )
          .collect();
        abiertas.push(...grupo);
      } else {
        const grupo = await ctx.db
          .query("incidencias")
          .withIndex("by_estado_timestamp", (q) => q.eq("estado", estado))
          .take(200);
        abiertas.push(...grupo);
      }
    }
    const ahora = Date.now();
    const filas = [];
    for (const incidencia of abiertas) {
      const servicio = await ctx.db.get(incidencia.servicioId);
      if (servicio === null) continue;
      const contexto = await contextoDeOperacion(ctx, incidencia.operacionId);
      const asignacion = await asignacionActivaDeServicio(ctx, servicio._id, [
        "confirmada",
        "completada",
      ]);
      const conductor =
        asignacion !== null ? await ctx.db.get(asignacion.conductorId) : null;
      const vehiculo = asignacion !== null ? await ctx.db.get(asignacion.vehiculoId) : null;
      filas.push({
        incidenciaId: incidencia._id,
        tipo: incidencia.tipo,
        severidad: incidencia.severidad,
        estado: incidencia.estado,
        descripcion: incidencia.descripcion,
        timestamp: incidencia.timestamp,
        edadHoras: Math.round((ahora - incidencia.timestamp) / 3600_000),
        servicioId: servicio._id,
        servicioFecha: servicio.fechaProgramada,
        servicioRuta: `${servicio.origenTexto} → ${servicio.destinoTexto}`,
        clienteNombre: contexto?.cliente?.nombre ?? "(sin cliente)",
        operacionNombre: contexto?.operacion.nombre ?? "(sin operación)",
        conductorNombre: conductor?.nombre,
        vehiculoPlaca: vehiculo?.placa,
      });
    }
    const pesoSeveridad = { critica: 0, alta: 1, media: 2, baja: 3 } as const;
    return filas.sort(
      (a, b) =>
        pesoSeveridad[a.severidad as keyof typeof pesoSeveridad] -
        pesoSeveridad[b.severidad as keyof typeof pesoSeveridad],
    );
  },
});

// ---------------------------------------------------------------------------
// Desempeño y finanzas
// ---------------------------------------------------------------------------

export const desempenoConductor = query({
  args: {
    conductorId: v.id("conductores"),
    desde: v.optional(v.string()),
    hasta: v.optional(v.string()),
  },
  returns: v.union(
    v.null(),
    v.object({
      conductorId: v.id("conductores"),
      nombre: v.string(),
      estado: v.string(),
      licenciaVence: v.string(),
      calificacionPromedio: v.optional(v.number()),
      serviciosCompletados: v.number(),
      asignacionesRechazadas: v.number(),
      retrasosInicio: v.number(),
      incidencias: v.number(),
      incidenciasCriticas: v.number(),
      checklistsRechazados: v.number(),
      evaluaciones: v.array(
        v.object({
          periodoInicio: v.string(),
          periodoFin: v.string(),
          resultado: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const conductor = await ctx.db.get(args.conductorId);
    if (conductor === null) return null;
    const enRango = (fecha: string) =>
      (args.desde === undefined || fecha >= args.desde) &&
      (args.hasta === undefined || fecha <= args.hasta);

    let completados = 0;
    let retrasos = 0;
    let incidenciasTotal = 0;
    let incidenciasCriticas = 0;
    const completadas = await ctx.db
      .query("asignacionesServicio")
      .withIndex("by_conductor_estado", (q) =>
        q.eq("conductorId", args.conductorId).eq("estado", "completada"),
      )
      .collect();
    for (const asignacion of completadas) {
      const servicio = await ctx.db.get(asignacion.servicioId);
      if (servicio === null || !enRango(servicio.fechaProgramada)) continue;
      completados += 1;
      const puntual = await inicioATiempo(ctx, servicio);
      if (puntual === false) retrasos += 1;
      const incidenciasServicio = await ctx.db
        .query("incidencias")
        .withIndex("by_servicio", (q) => q.eq("servicioId", servicio._id))
        .collect();
      incidenciasTotal += incidenciasServicio.length;
      incidenciasCriticas += incidenciasServicio.filter(
        (i) => i.severidad === "critica",
      ).length;
    }
    const rechazadas = await ctx.db
      .query("asignacionesServicio")
      .withIndex("by_conductor_estado", (q) =>
        q.eq("conductorId", args.conductorId).eq("estado", "rechazada"),
      )
      .collect();
    const checklists = await ctx.db
      .query("checklistsPreoperativos")
      .withIndex("by_conductor_fecha", (q) => q.eq("conductorId", args.conductorId))
      .collect();
    const evaluaciones = await ctx.db
      .query("evaluacionesDesempeno")
      .withIndex("by_conductor", (q) => q.eq("conductorId", args.conductorId))
      .collect();
    return {
      conductorId: conductor._id,
      nombre: conductor.nombre,
      estado: conductor.estado,
      licenciaVence: conductor.licenciaVence,
      calificacionPromedio: conductor.calificacionPromedio,
      serviciosCompletados: completados,
      asignacionesRechazadas: rechazadas.length,
      retrasosInicio: retrasos,
      incidencias: incidenciasTotal,
      incidenciasCriticas,
      checklistsRechazados: checklists.filter((c) => c.resultado === "rechazado").length,
      evaluaciones: evaluaciones.map((e) => ({
        periodoInicio: e.periodoInicio,
        periodoFin: e.periodoFin,
        resultado: e.resultado,
      })),
    };
  },
});

export const liquidacionPorPropietario = query({
  args: {
    propietarioId: v.id("propietarios"),
    desde: v.string(),
    hasta: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      propietarioNombre: v.string(),
      cuentaPago: v.optional(v.string()),
      items: v.array(
        v.object({
          liquidacionId: v.id("liquidaciones"),
          servicioId: v.id("serviciosTransporte"),
          fechaServicio: v.string(),
          vehiculoPlaca: v.optional(v.string()),
          valorBruto: v.number(),
          descuentos: v.optional(v.number()),
          bonos: v.optional(v.number()),
          valorNeto: v.number(),
          estado: v.string(),
        }),
      ),
      totales: v.object({
        bruto: v.number(),
        descuentos: v.number(),
        bonos: v.number(),
        neto: v.number(),
        pendiente: v.number(),
        aprobado: v.number(),
        pagado: v.number(),
        retenido: v.number(),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    const propietario = await ctx.db.get(args.propietarioId);
    if (propietario === null) return null;
    const todas: Array<Doc<"liquidaciones">> = [];
    for (const estado of ["pendiente", "aprobada", "pagada", "retenida"] as const) {
      const grupo = await ctx.db
        .query("liquidaciones")
        .withIndex("by_propietario_estado", (q) =>
          q.eq("propietarioId", args.propietarioId).eq("estado", estado),
        )
        .collect();
      todas.push(...grupo);
    }
    const items = [];
    const totales = {
      bruto: 0,
      descuentos: 0,
      bonos: 0,
      neto: 0,
      pendiente: 0,
      aprobado: 0,
      pagado: 0,
      retenido: 0,
    };
    for (const liquidacion of todas) {
      const servicio = await ctx.db.get(liquidacion.servicioId);
      if (servicio === null) continue;
      if (servicio.fechaProgramada < args.desde || servicio.fechaProgramada > args.hasta)
        continue;
      const asignacion = await asignacionActivaDeServicio(ctx, servicio._id, [
        "completada",
        "confirmada",
      ]);
      const vehiculo = asignacion !== null ? await ctx.db.get(asignacion.vehiculoId) : null;
      items.push({
        liquidacionId: liquidacion._id,
        servicioId: servicio._id,
        fechaServicio: servicio.fechaProgramada,
        vehiculoPlaca: vehiculo?.placa,
        valorBruto: liquidacion.valorBruto,
        descuentos: liquidacion.descuentos,
        bonos: liquidacion.bonos,
        valorNeto: liquidacion.valorNeto,
        estado: liquidacion.estado,
      });
      totales.bruto += liquidacion.valorBruto;
      totales.descuentos += liquidacion.descuentos ?? 0;
      totales.bonos += liquidacion.bonos ?? 0;
      totales.neto += liquidacion.valorNeto;
      if (liquidacion.estado === "pendiente") totales.pendiente += liquidacion.valorNeto;
      if (liquidacion.estado === "aprobada") totales.aprobado += liquidacion.valorNeto;
      if (liquidacion.estado === "pagada") totales.pagado += liquidacion.valorNeto;
      if (liquidacion.estado === "retenida") totales.retenido += liquidacion.valorNeto;
    }
    return {
      propietarioNombre: propietario.nombre,
      cuentaPago: propietario.cuentaPago,
      items: items.sort((a, b) => (a.fechaServicio < b.fechaServicio ? -1 : 1)),
      totales,
    };
  },
});

export const ocupacionRuta = query({
  args: {
    rutaId: v.id("rutas"),
    desde: v.string(),
    hasta: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      rutaNombre: v.string(),
      tipoRuta: v.string(),
      capacidadObjetivo: v.optional(v.number()),
      totalServicios: v.number(),
      serviciosCompletados: v.number(),
      pasajerosProgramados: v.number(),
      pasajerosReales: v.number(),
      noShows: v.number(),
      utilizacionPorcentaje: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const ruta = await ctx.db.get(args.rutaId);
    if (ruta === null) return null;
    const servicios = await ctx.db
      .query("serviciosTransporte")
      .withIndex("by_ruta_fecha", (q) =>
        q.eq("rutaId", args.rutaId).gte("fechaProgramada", args.desde).lte(
          "fechaProgramada",
          args.hasta,
        ),
      )
      .collect();
    let programados = 0;
    let reales = 0;
    let noShows = 0;
    let completados = 0;
    for (const servicio of servicios) {
      programados += servicio.cantidadPasajerosProgramada ?? 0;
      reales += servicio.cantidadPasajerosReal ?? 0;
      if (servicio.estado === "completado") completados += 1;
      const pasajeros = await ctx.db
        .query("pasajerosServicio")
        .withIndex("by_servicio_estado", (q) =>
          q.eq("servicioId", servicio._id).eq("estado", "noShow"),
        )
        .collect();
      noShows += pasajeros.length;
    }
    const capacidadTotal =
      ruta.capacidadObjetivo !== undefined ? ruta.capacidadObjetivo * servicios.length : null;
    return {
      rutaNombre: ruta.nombre,
      tipoRuta: ruta.tipoRuta,
      capacidadObjetivo: ruta.capacidadObjetivo,
      totalServicios: servicios.length,
      serviciosCompletados: completados,
      pasajerosProgramados: programados,
      pasajerosReales: reales,
      noShows,
      utilizacionPorcentaje:
        capacidadTotal !== null && capacidadTotal > 0
          ? Math.round((reales / capacidadTotal) * 100)
          : null,
    };
  },
});

// ---------------------------------------------------------------------------
// Eventos — centro de comando
// ---------------------------------------------------------------------------

export const controlEvento = query({
  args: { eventoId: v.id("eventos") },
  returns: v.union(
    v.null(),
    v.object({
      eventoNombre: v.string(),
      clienteNombre: v.string(),
      estado: v.string(),
      nivelComplejidad: v.string(),
      modeloOperacion: v.string(),
      sedePrincipal: v.string(),
      fechaInicio: v.string(),
      fechaFin: v.string(),
      operaciones: v.number(),
      serviciosPorEstado: resumenPorEstadoValidator,
      incidenciasCriticasAbiertas: v.array(
        v.object({
          incidenciaId: v.id("incidencias"),
          descripcion: v.string(),
          severidad: v.string(),
          timestamp: v.number(),
        }),
      ),
      participantes: v.array(
        v.object({ actorTipo: v.string(), rol: v.string(), actorId: v.string() }),
      ),
      ultimasEvidencias: v.array(
        v.object({
          servicioId: v.id("serviciosTransporte"),
          tipo: v.string(),
          descripcion: v.string(),
          timestamp: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const evento = await ctx.db.get(args.eventoId);
    if (evento === null) return null;
    const cliente = await ctx.db.get(evento.clienteId);
    if (evento.programaId === undefined) {
      return {
        eventoNombre: evento.nombre,
        clienteNombre: cliente?.nombre ?? "(sin cliente)",
        estado: evento.estado,
        nivelComplejidad: evento.nivelComplejidad,
        modeloOperacion: evento.modeloOperacion,
        sedePrincipal: evento.sedePrincipal,
        fechaInicio: evento.fechaInicio,
        fechaFin: evento.fechaFin,
        operaciones: 0,
        serviciosPorEstado: resumenPorEstado([]),
        incidenciasCriticasAbiertas: [],
        participantes: [],
        ultimasEvidencias: [],
      };
    }
    const operaciones = await ctx.db
      .query("operaciones")
      .withIndex("by_programa", (q) => q.eq("programaId", evento.programaId!))
      .collect();
    const servicios: Array<Doc<"serviciosTransporte">> = [];
    const criticas = [];
    const participantes = [];
    for (const operacion of operaciones) {
      servicios.push(...(await serviciosDeOperacion(ctx, operacion._id)));
      for (const estado of ["abierta", "enGestion"] as const) {
        const grupo = await ctx.db
          .query("incidencias")
          .withIndex("by_operacion_estado_severidad", (q) =>
            q.eq("operacionId", operacion._id).eq("estado", estado).eq("severidad", "critica"),
          )
          .collect();
        criticas.push(
          ...grupo.map((i) => ({
            incidenciaId: i._id,
            descripcion: i.descripcion,
            severidad: i.severidad,
            timestamp: i.timestamp,
          })),
        );
      }
      const activos = await ctx.db
        .query("participantesOperacion")
        .withIndex("by_operacion_estado", (q) =>
          q.eq("operacionId", operacion._id).eq("estado", "activo"),
        )
        .collect();
      participantes.push(
        ...activos.map((p) => ({ actorTipo: p.actorTipo, rol: p.rol, actorId: p.actorId })),
      );
    }
    const evidencias = [];
    for (const servicio of servicios.slice(0, 50)) {
      const ultimas = await ctx.db
        .query("evidenciasServicio")
        .withIndex("by_servicio_timestamp", (q) => q.eq("servicioId", servicio._id))
        .order("desc")
        .take(2);
      evidencias.push(
        ...ultimas.map((e) => ({
          servicioId: e.servicioId,
          tipo: e.tipo,
          descripcion: e.descripcion,
          timestamp: e.timestamp,
        })),
      );
    }
    evidencias.sort((a, b) => b.timestamp - a.timestamp);
    return {
      eventoNombre: evento.nombre,
      clienteNombre: cliente?.nombre ?? "(sin cliente)",
      estado: evento.estado,
      nivelComplejidad: evento.nivelComplejidad,
      modeloOperacion: evento.modeloOperacion,
      sedePrincipal: evento.sedePrincipal,
      fechaInicio: evento.fechaInicio,
      fechaFin: evento.fechaFin,
      operaciones: operaciones.length,
      serviciosPorEstado: resumenPorEstado(servicios),
      incidenciasCriticasAbiertas: criticas,
      participantes,
      ultimasEvidencias: evidencias.slice(0, 10),
    };
  },
});
