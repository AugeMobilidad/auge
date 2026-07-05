/**
 * Queries con forma de view-model para el futuro dashboard web de logística.
 *
 * Cada query corresponde a una pantalla/panel del dashboard y devuelve datos
 * listos para render (nombres, placas, alertas), no tablas crudas. Las
 * escrituras del dashboard son las mutations `dashboard*` de
 * `accionesOperativas.ts`.
 */
import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  asignacionActivaDeServicio,
  checklistAprobadoDeServicio,
  contextoDeOperacion,
  resumenCumplimientoDeEntidad,
} from "./lib/consultas";
import { hoyISO, sumarDiasISO } from "./lib/horarios";

// ---------------------------------------------------------------------------
// Resumen operativo
// ---------------------------------------------------------------------------

export const dashboardResumenOperativo = query({
  args: {
    desde: v.optional(v.string()),
    hasta: v.optional(v.string()),
  },
  returns: v.object({
    rango: v.object({ desde: v.string(), hasta: v.string() }),
    serviciosPorEstado: v.object({
      programado: v.number(),
      asignado: v.number(),
      enPreparacion: v.number(),
      enCurso: v.number(),
      completado: v.number(),
      cancelado: v.number(),
      fallido: v.number(),
    }),
    pendientesAsignacion: v.number(),
    serviciosActivos: v.number(),
    incidenciasAbiertas: v.number(),
    incidenciasCriticas: v.number(),
    vehiculosHabilitados: v.number(),
    conductoresActivos: v.number(),
    documentosPorVencer30Dias: v.number(),
  }),
  handler: async (ctx, args) => {
    const desde = args.desde ?? hoyISO();
    const hasta = args.hasta ?? desde;
    const resumen = {
      programado: 0,
      asignado: 0,
      enPreparacion: 0,
      enCurso: 0,
      completado: 0,
      cancelado: 0,
      fallido: 0,
    };
    for (const estado of Object.keys(resumen) as Array<keyof typeof resumen>) {
      const grupo = await ctx.db
        .query("serviciosTransporte")
        .withIndex("by_estado_fecha", (q) =>
          q.eq("estado", estado).gte("fechaProgramada", desde).lte("fechaProgramada", hasta),
        )
        .collect();
      resumen[estado] = grupo.length;
    }
    let incidenciasAbiertas = 0;
    let incidenciasCriticas = 0;
    for (const estado of ["abierta", "enGestion"] as const) {
      const grupo = await ctx.db
        .query("incidencias")
        .withIndex("by_estado_timestamp", (q) => q.eq("estado", estado))
        .collect();
      incidenciasAbiertas += grupo.length;
      incidenciasCriticas += grupo.filter((i) => i.severidad === "critica").length;
    }
    const vehiculos = await ctx.db
      .query("vehiculos")
      .withIndex("by_estado", (q) => q.eq("estado", "habilitado"))
      .collect();
    const conductores = await ctx.db
      .query("conductores")
      .withIndex("by_estado", (q) => q.eq("estado", "activo"))
      .collect();
    const limite = sumarDiasISO(hoyISO(), 30);
    let documentosPorVencer = 0;
    for (const estado of ["vigente", "porVencer"] as const) {
      const grupo = await ctx.db
        .query("documentosCumplimiento")
        .withIndex("by_estado_vencimiento", (q) =>
          q.eq("estado", estado).gte("fechaVencimiento", hoyISO()).lte("fechaVencimiento", limite),
        )
        .collect();
      documentosPorVencer += grupo.length;
    }
    return {
      rango: { desde, hasta },
      serviciosPorEstado: resumen,
      pendientesAsignacion: resumen.programado,
      serviciosActivos: resumen.enPreparacion + resumen.enCurso,
      incidenciasAbiertas,
      incidenciasCriticas,
      vehiculosHabilitados: vehiculos.length,
      conductoresActivos: conductores.length,
      documentosPorVencer30Dias: documentosPorVencer,
    };
  },
});

// ---------------------------------------------------------------------------
// Tablero de despacho
// ---------------------------------------------------------------------------

const servicioDespachoValidator = v.object({
  servicioId: v.id("serviciosTransporte"),
  fechaProgramada: v.string(),
  horaInicioProgramada: v.string(),
  origenTexto: v.string(),
  destinoTexto: v.string(),
  tipoVehiculoRequerido: v.string(),
  prioridad: v.string(),
  estado: v.string(),
  clienteNombre: v.string(),
  operacionNombre: v.string(),
  alertas: v.array(v.string()),
});

async function filaDespacho(ctx: QueryCtx, servicio: Doc<"serviciosTransporte">) {
  const contexto = await contextoDeOperacion(ctx, servicio.operacionId);
  const alertas: string[] = [];
  if (servicio.prioridad !== "normal") alertas.push(`prioridad ${servicio.prioridad}`);
  const propuesta = await asignacionActivaDeServicio(ctx, servicio._id, ["propuesta"]);
  if (propuesta !== null) alertas.push("propuesta sin confirmar");
  const incidencias = await ctx.db
    .query("incidencias")
    .withIndex("by_servicio", (q) => q.eq("servicioId", servicio._id))
    .collect();
  const abiertas = incidencias.filter(
    (i) => i.estado === "abierta" || i.estado === "enGestion",
  );
  if (abiertas.length > 0) alertas.push(`${abiertas.length} incidencia(s) abierta(s)`);
  return {
    servicioId: servicio._id,
    fechaProgramada: servicio.fechaProgramada,
    horaInicioProgramada: servicio.horaInicioProgramada,
    origenTexto: servicio.origenTexto,
    destinoTexto: servicio.destinoTexto,
    tipoVehiculoRequerido: servicio.tipoVehiculoRequerido,
    prioridad: servicio.prioridad,
    estado: servicio.estado,
    clienteNombre: contexto?.cliente?.nombre ?? "(sin cliente)",
    operacionNombre: contexto?.operacion.nombre ?? "(sin operación)",
    alertas,
  };
}

export const dashboardTableroDespacho = query({
  args: { fecha: v.optional(v.string()) },
  returns: v.object({
    fecha: v.string(),
    serviciosPendientes: v.array(servicioDespachoValidator),
    asignacionesDelDia: v.array(
      v.object({
        asignacionId: v.id("asignacionesServicio"),
        servicioId: v.id("serviciosTransporte"),
        estado: v.string(),
        horaInicioProgramada: v.string(),
        rutaTexto: v.string(),
        vehiculoPlaca: v.string(),
        conductorNombre: v.string(),
      }),
    ),
    conductoresAsignables: v.array(
      v.object({
        conductorId: v.id("conductores"),
        nombre: v.string(),
        telefono: v.string(),
        licenciaVence: v.string(),
      }),
    ),
    vehiculosAsignables: v.array(
      v.object({
        vehiculoId: v.id("vehiculos"),
        placa: v.string(),
        tipoVehiculo: v.string(),
        capacidadPasajeros: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const fecha = args.fecha ?? hoyISO();
    const pendientes = await ctx.db
      .query("serviciosTransporte")
      .withIndex("by_estado_fecha", (q) =>
        q.eq("estado", "programado").eq("fechaProgramada", fecha),
      )
      .take(100);
    const serviciosPendientes = [];
    for (const servicio of pendientes) {
      serviciosPendientes.push(await filaDespacho(ctx, servicio));
    }

    // Asignaciones del día en cualquier estado operativo del servicio.
    const asignacionesDelDia = [];
    for (const estado of ["asignado", "enPreparacion", "enCurso"] as const) {
      const servicios = await ctx.db
        .query("serviciosTransporte")
        .withIndex("by_estado_fecha", (q) =>
          q.eq("estado", estado).eq("fechaProgramada", fecha),
        )
        .collect();
      for (const servicio of servicios) {
        const asignacion = await asignacionActivaDeServicio(ctx, servicio._id, ["confirmada"]);
        if (asignacion === null) continue;
        const vehiculo = await ctx.db.get(asignacion.vehiculoId);
        const conductor = await ctx.db.get(asignacion.conductorId);
        asignacionesDelDia.push({
          asignacionId: asignacion._id,
          servicioId: servicio._id,
          estado: servicio.estado,
          horaInicioProgramada: servicio.horaInicioProgramada,
          rutaTexto: `${servicio.origenTexto} → ${servicio.destinoTexto}`,
          vehiculoPlaca: vehiculo?.placa ?? "(?)",
          conductorNombre: conductor?.nombre ?? "(?)",
        });
      }
    }

    const conductores = await ctx.db
      .query("conductores")
      .withIndex("by_estado", (q) => q.eq("estado", "activo"))
      .collect();
    const vehiculos = await ctx.db
      .query("vehiculos")
      .withIndex("by_estado", (q) => q.eq("estado", "habilitado"))
      .collect();
    return {
      fecha,
      serviciosPendientes,
      asignacionesDelDia,
      conductoresAsignables: conductores
        .filter((c) => c.licenciaVence >= fecha)
        .map((c) => ({
          conductorId: c._id,
          nombre: c.nombre,
          telefono: c.telefono,
          licenciaVence: c.licenciaVence,
        })),
      vehiculosAsignables: vehiculos.map((vh) => ({
        vehiculoId: vh._id,
        placa: vh.placa,
        tipoVehiculo: vh.tipoVehiculo,
        capacidadPasajeros: vh.capacidadPasajeros,
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// Detalle de servicio (pantalla de inspección)
// ---------------------------------------------------------------------------

export const dashboardDetalleServicio = query({
  args: { servicioId: v.id("serviciosTransporte") },
  returns: v.union(
    v.null(),
    v.object({
      servicio: servicioDespachoValidator,
      rutaNombre: v.optional(v.string()),
      tarifaAcordada: v.optional(v.number()),
      asignacion: v.union(
        v.null(),
        v.object({
          estado: v.string(),
          vehiculoPlaca: v.string(),
          conductorNombre: v.string(),
          conductorTelefono: v.string(),
          gestorNombre: v.optional(v.string()),
        }),
      ),
      checklist: v.union(
        v.null(),
        v.object({ resultado: v.string(), fecha: v.number() }),
      ),
      gpsResumen: v.object({
        puntos: v.number(),
        ultimoTimestamp: v.optional(v.number()),
        hitos: v.array(v.object({ evento: v.string(), timestamp: v.number() })),
      }),
      evidencias: v.number(),
      incidenciasAbiertas: v.number(),
      liquidacion: v.union(
        v.null(),
        v.object({ estado: v.string(), valorNeto: v.number() }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const servicio = await ctx.db.get(args.servicioId);
    if (servicio === null) return null;
    const fila = await filaDespacho(ctx, servicio);
    const ruta = servicio.rutaId !== undefined ? await ctx.db.get(servicio.rutaId) : null;
    const asignacion = await asignacionActivaDeServicio(ctx, servicio._id, [
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
        vehiculoPlaca: vehiculo?.placa ?? "(?)",
        conductorNombre: conductor?.nombre ?? "(?)",
        conductorTelefono: conductor?.telefono ?? "",
        gestorNombre: gestor?.nombre,
      };
    }
    const checklist = await checklistAprobadoDeServicio(ctx, servicio._id);
    const gps = await ctx.db
      .query("seguimientosGps")
      .withIndex("by_servicio_timestamp", (q) => q.eq("servicioId", servicio._id))
      .collect();
    const evidencias = await ctx.db
      .query("evidenciasServicio")
      .withIndex("by_servicio_timestamp", (q) => q.eq("servicioId", servicio._id))
      .collect();
    const incidencias = await ctx.db
      .query("incidencias")
      .withIndex("by_servicio", (q) => q.eq("servicioId", servicio._id))
      .collect();
    const liquidacion = await ctx.db
      .query("liquidaciones")
      .withIndex("by_servicio", (q) => q.eq("servicioId", servicio._id))
      .first();
    return {
      servicio: fila,
      rutaNombre: ruta?.nombre,
      tarifaAcordada: servicio.tarifaAcordada,
      asignacion: asignacionShape,
      checklist:
        checklist !== null ? { resultado: checklist.resultado, fecha: checklist.fecha } : null,
      gpsResumen: {
        puntos: gps.length,
        ultimoTimestamp: gps.length > 0 ? gps[gps.length - 1].timestamp : undefined,
        hitos: gps
          .filter((h) => h.evento !== "ubicacion")
          .map((h) => ({ evento: h.evento, timestamp: h.timestamp })),
      },
      evidencias: evidencias.length,
      incidenciasAbiertas: incidencias.filter(
        (i) => i.estado === "abierta" || i.estado === "enGestion",
      ).length,
      liquidacion:
        liquidacion !== null
          ? { estado: liquidacion.estado, valorNeto: liquidacion.valorNeto }
          : null,
    };
  },
});

// ---------------------------------------------------------------------------
// Panel de cumplimiento
// ---------------------------------------------------------------------------

export const dashboardCumplimiento = query({
  args: {},
  returns: v.object({
    documentosVencidos: v.number(),
    documentosPorVencer30Dias: v.number(),
    conductoresBloqueados: v.array(
      v.object({
        conductorId: v.id("conductores"),
        nombre: v.string(),
        motivo: v.string(),
      }),
    ),
    vehiculosBloqueados: v.array(
      v.object({
        vehiculoId: v.id("vehiculos"),
        placa: v.string(),
        motivo: v.string(),
      }),
    ),
    mantenimientosPendientes: v.array(
      v.object({
        mantenimientoId: v.id("mantenimientos"),
        vehiculoPlaca: v.string(),
        tipo: v.string(),
        fechaProgramada: v.string(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const vencidos = await ctx.db
      .query("documentosCumplimiento")
      .withIndex("by_estado_vencimiento", (q) => q.eq("estado", "vencido"))
      .collect();
    const hoy = hoyISO();
    const limite = sumarDiasISO(hoy, 30);
    let porVencer = 0;
    for (const estado of ["vigente", "porVencer"] as const) {
      const grupo = await ctx.db
        .query("documentosCumplimiento")
        .withIndex("by_estado_vencimiento", (q) =>
          q.eq("estado", estado).gte("fechaVencimiento", hoy).lte("fechaVencimiento", limite),
        )
        .collect();
      porVencer += grupo.length;
    }

    const conductoresBloqueados = [];
    const suspendidos = await ctx.db
      .query("conductores")
      .withIndex("by_estado", (q) => q.eq("estado", "suspendido"))
      .collect();
    for (const conductor of suspendidos) {
      conductoresBloqueados.push({
        conductorId: conductor._id,
        nombre: conductor.nombre,
        motivo: "suspendido",
      });
    }
    const activos = await ctx.db
      .query("conductores")
      .withIndex("by_estado", (q) => q.eq("estado", "activo"))
      .collect();
    for (const conductor of activos) {
      if (conductor.licenciaVence < hoy) {
        conductoresBloqueados.push({
          conductorId: conductor._id,
          nombre: conductor.nombre,
          motivo: `licencia vencida ${conductor.licenciaVence}`,
        });
        continue;
      }
      const cumplimiento = await resumenCumplimientoDeEntidad(ctx, "conductorId", conductor._id);
      if (cumplimiento.vencidos > 0) {
        conductoresBloqueados.push({
          conductorId: conductor._id,
          nombre: conductor.nombre,
          motivo: `${cumplimiento.vencidos} documento(s) vencido(s)`,
        });
      }
    }

    const vehiculosBloqueados = [];
    for (const estado of ["suspendido", "enMantenimiento"] as const) {
      const grupo = await ctx.db
        .query("vehiculos")
        .withIndex("by_estado", (q) => q.eq("estado", estado))
        .collect();
      for (const vehiculo of grupo) {
        vehiculosBloqueados.push({
          vehiculoId: vehiculo._id,
          placa: vehiculo.placa,
          motivo: estado,
        });
      }
    }
    const habilitados = await ctx.db
      .query("vehiculos")
      .withIndex("by_estado", (q) => q.eq("estado", "habilitado"))
      .collect();
    for (const vehiculo of habilitados) {
      const cumplimiento = await resumenCumplimientoDeEntidad(ctx, "vehiculoId", vehiculo._id);
      if (cumplimiento.vencidos > 0) {
        vehiculosBloqueados.push({
          vehiculoId: vehiculo._id,
          placa: vehiculo.placa,
          motivo: `${cumplimiento.vencidos} documento(s) vencido(s)`,
        });
      }
    }

    const pendientes = await ctx.db
      .query("mantenimientos")
      .withIndex("by_resultado_fecha", (q) => q.eq("resultado", "pendiente"))
      .collect();
    const mantenimientosPendientes = [];
    for (const mantenimiento of pendientes) {
      const vehiculo = await ctx.db.get(mantenimiento.vehiculoId);
      mantenimientosPendientes.push({
        mantenimientoId: mantenimiento._id,
        vehiculoPlaca: vehiculo?.placa ?? "(?)",
        tipo: mantenimiento.tipo,
        fechaProgramada: mantenimiento.fechaProgramada,
      });
    }
    return {
      documentosVencidos: vencidos.length,
      documentosPorVencer30Dias: porVencer,
      conductoresBloqueados,
      vehiculosBloqueados,
      mantenimientosPendientes,
    };
  },
});

// ---------------------------------------------------------------------------
// Panel de eventos (centro de comando)
// ---------------------------------------------------------------------------

export const dashboardEventos = query({
  args: {},
  returns: v.array(
    v.object({
      eventoId: v.id("eventos"),
      nombre: v.string(),
      clienteNombre: v.string(),
      estado: v.string(),
      nivelComplejidad: v.string(),
      fechaInicio: v.string(),
      fechaFin: v.string(),
      serviciosEnCurso: v.number(),
      incidenciasCriticasAbiertas: v.number(),
      coordinadores: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const filas = [];
    for (const estado of ["planeacion", "montaje", "enCurso"] as const) {
      const eventos = await ctx.db
        .query("eventos")
        .withIndex("by_estado", (q) => q.eq("estado", estado))
        .collect();
      for (const evento of eventos) {
        const cliente = await ctx.db.get(evento.clienteId);
        let serviciosEnCurso = 0;
        let criticas = 0;
        let coordinadores = 0;
        if (evento.programaId !== undefined) {
          const operaciones = await ctx.db
            .query("operaciones")
            .withIndex("by_programa", (q) => q.eq("programaId", evento.programaId!))
            .collect();
          for (const operacion of operaciones) {
            const enCurso = await ctx.db
              .query("serviciosTransporte")
              .withIndex("by_operacion_estado_fecha", (q) =>
                q.eq("operacionId", operacion._id).eq("estado", "enCurso"),
              )
              .collect();
            serviciosEnCurso += enCurso.length;
            for (const estadoInc of ["abierta", "enGestion"] as const) {
              const grupo = await ctx.db
                .query("incidencias")
                .withIndex("by_operacion_estado_severidad", (q) =>
                  q
                    .eq("operacionId", operacion._id)
                    .eq("estado", estadoInc)
                    .eq("severidad", "critica"),
                )
                .collect();
              criticas += grupo.length;
            }
            const participantes = await ctx.db
              .query("participantesOperacion")
              .withIndex("by_operacion_estado", (q) =>
                q.eq("operacionId", operacion._id).eq("estado", "activo"),
              )
              .collect();
            coordinadores += participantes.filter(
              (p) => p.actorTipo === "coordinador" || p.actorTipo === "auxiliar",
            ).length;
          }
        }
        filas.push({
          eventoId: evento._id,
          nombre: evento.nombre,
          clienteNombre: cliente?.nombre ?? "(sin cliente)",
          estado: evento.estado,
          nivelComplejidad: evento.nivelComplejidad,
          fechaInicio: evento.fechaInicio,
          fechaFin: evento.fechaFin,
          serviciosEnCurso,
          incidenciasCriticasAbiertas: criticas,
          coordinadores,
        });
      }
    }
    return filas;
  },
});

// ---------------------------------------------------------------------------
// Panel de liquidaciones
// ---------------------------------------------------------------------------

export const dashboardLiquidaciones = query({
  args: {},
  returns: v.object({
    porEstado: v.object({
      pendiente: v.object({ cantidad: v.number(), total: v.number() }),
      aprobada: v.object({ cantidad: v.number(), total: v.number() }),
      pagada: v.object({ cantidad: v.number(), total: v.number() }),
      retenida: v.object({ cantidad: v.number(), total: v.number() }),
    }),
    porBeneficiario: v.array(
      v.object({
        beneficiarioTipo: v.string(),
        beneficiarioNombre: v.string(),
        cantidad: v.number(),
        totalNeto: v.number(),
        pendienteAprobacion: v.number(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const porEstado = {
      pendiente: { cantidad: 0, total: 0 },
      aprobada: { cantidad: 0, total: 0 },
      pagada: { cantidad: 0, total: 0 },
      retenida: { cantidad: 0, total: 0 },
    };
    const acumulado = new Map<
      string,
      {
        beneficiarioTipo: string;
        beneficiarioNombre: string;
        cantidad: number;
        totalNeto: number;
        pendienteAprobacion: number;
      }
    >();
    for (const estado of ["pendiente", "aprobada", "pagada", "retenida"] as const) {
      const grupo = await ctx.db
        .query("liquidaciones")
        .withIndex("by_estado", (q) => q.eq("estado", estado))
        .collect();
      for (const liquidacion of grupo) {
        porEstado[estado].cantidad += 1;
        porEstado[estado].total += liquidacion.valorNeto;
        let tipo = "conductor";
        let nombre = "(sin beneficiario)";
        let clave = "none";
        if (liquidacion.propietarioId !== undefined) {
          const propietario = await ctx.db.get(liquidacion.propietarioId);
          tipo = "propietario";
          nombre = propietario?.nombre ?? "(?)";
          clave = `p:${liquidacion.propietarioId}`;
        } else if (liquidacion.gestorId !== undefined) {
          const gestor = await ctx.db.get(liquidacion.gestorId);
          tipo = "gestor";
          nombre = gestor?.nombre ?? "(?)";
          clave = `g:${liquidacion.gestorId}`;
        } else if (liquidacion.conductorId !== undefined) {
          const conductor = await ctx.db.get(liquidacion.conductorId);
          tipo = "conductor";
          nombre = conductor?.nombre ?? "(?)";
          clave = `c:${liquidacion.conductorId}`;
        }
        const fila = acumulado.get(clave) ?? {
          beneficiarioTipo: tipo,
          beneficiarioNombre: nombre,
          cantidad: 0,
          totalNeto: 0,
          pendienteAprobacion: 0,
        };
        fila.cantidad += 1;
        fila.totalNeto += liquidacion.valorNeto;
        if (estado === "pendiente") fila.pendienteAprobacion += liquidacion.valorNeto;
        acumulado.set(clave, fila);
      }
    }
    return {
      porEstado,
      porBeneficiario: [...acumulado.values()].sort((a, b) => b.totalNeto - a.totalNeto),
    };
  },
});
