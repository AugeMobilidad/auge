/**
 * Analítica de control operacional — señales de calidad del modelo Auge.
 *
 * No son controles anticorrupción: son chequeos de negocio (planeación vs
 * improvisación, puntualidad verificable, utilización de flota, recurrencia de
 * incidencias, desempeño de gestores, reproceso por cliente, ocupación de
 * rutas y bloqueos documentales). Toda salida trae nombres legibles y un
 * campo `motivo` interpretable, no solo ids.
 */
import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { contextoDeOperacion } from "./lib/consultas";
import { hoyISO, inicioProgramadoMs, sumarDiasISO } from "./lib/horarios";

async function serviciosEnRango(
  ctx: QueryCtx,
  desde: string,
  hasta: string,
): Promise<Array<Doc<"serviciosTransporte">>> {
  return await ctx.db
    .query("serviciosTransporte")
    .withIndex("by_fecha", (q) =>
      q.gte("fechaProgramada", desde).lte("fechaProgramada", hasta),
    )
    .collect();
}

async function primeraAsignacionDeServicio(
  ctx: QueryCtx,
  servicioId: Doc<"serviciosTransporte">["_id"],
): Promise<Doc<"asignacionesServicio"> | null> {
  const asignaciones = await ctx.db
    .query("asignacionesServicio")
    .withIndex("by_servicio_estado", (q) => q.eq("servicioId", servicioId))
    .collect();
  return asignaciones.sort((a, b) => a.fechaAsignacion - b.fechaAsignacion)[0] ?? null;
}

// ---------------------------------------------------------------------------
// 1. Riesgo de improvisación
// ---------------------------------------------------------------------------

export const riesgoImprovisacion = query({
  args: {
    desde: v.optional(v.string()),
    hasta: v.optional(v.string()),
    umbralMinutos: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      servicioId: v.id("serviciosTransporte"),
      clienteNombre: v.string(),
      operacionNombre: v.string(),
      fechaProgramada: v.string(),
      horaInicioProgramada: v.string(),
      minutosCreacionAInicio: v.number(),
      minutosAsignacionAInicio: v.union(v.number(), v.null()),
      motivo: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const hoy = hoyISO();
    const desde = args.desde ?? sumarDiasISO(hoy, -30);
    const hasta = args.hasta ?? hoy;
    const umbral = args.umbralMinutos ?? 120;
    const servicios = await serviciosEnRango(ctx, desde, hasta);
    const filas = [];
    for (const servicio of servicios) {
      const inicio = inicioProgramadoMs(servicio);
      const minutosCreacion = Math.round((inicio - servicio._creationTime) / 60_000);
      const asignacion = await primeraAsignacionDeServicio(ctx, servicio._id);
      const minutosAsignacion =
        asignacion !== null
          ? Math.round((inicio - asignacion.fechaAsignacion) / 60_000)
          : null;
      const creacionTardia = minutosCreacion < umbral;
      const asignacionTardia = minutosAsignacion !== null && minutosAsignacion < umbral;
      if (!creacionTardia && !asignacionTardia) continue;
      const contexto = await contextoDeOperacion(ctx, servicio.operacionId);
      const motivos = [];
      if (creacionTardia)
        motivos.push(`creado ${minutosCreacion} min antes del inicio`);
      if (asignacionTardia)
        motivos.push(`asignado ${minutosAsignacion} min antes del inicio`);
      filas.push({
        servicioId: servicio._id,
        clienteNombre: contexto?.cliente?.nombre ?? "(sin cliente)",
        operacionNombre: contexto?.operacion.nombre ?? "(sin operación)",
        fechaProgramada: servicio.fechaProgramada,
        horaInicioProgramada: servicio.horaInicioProgramada,
        minutosCreacionAInicio: minutosCreacion,
        minutosAsignacionAInicio: minutosAsignacion,
        motivo: motivos.join("; "),
      });
    }
    return filas.sort((a, b) => a.minutosCreacionAInicio - b.minutosCreacionAInicio);
  },
});

// ---------------------------------------------------------------------------
// 2. Puntualidad verificable
// ---------------------------------------------------------------------------

export const puntualidadVerificable = query({
  args: {
    desde: v.string(),
    hasta: v.string(),
    toleranciaMinutos: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      servicioId: v.id("serviciosTransporte"),
      clienteNombre: v.string(),
      fechaProgramada: v.string(),
      horaInicioProgramada: v.string(),
      estadoServicio: v.string(),
      estadoPuntualidad: v.union(
        v.literal("puntual"),
        v.literal("tarde"),
        v.literal("sinVerificacion"),
      ),
      minutosDesviacionInicio: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const tolerancia = (args.toleranciaMinutos ?? 10) * 60_000;
    const servicios = await serviciosEnRango(ctx, args.desde, args.hasta);
    const filas = [];
    for (const servicio of servicios) {
      if (servicio.estado === "programado" || servicio.estado === "cancelado") continue;
      const gps = await ctx.db
        .query("seguimientosGps")
        .withIndex("by_servicio_timestamp", (q) => q.eq("servicioId", servicio._id))
        .collect();
      const hitoInicio = gps.find((h) => h.evento === "inicio");
      const contexto = await contextoDeOperacion(ctx, servicio.operacionId);
      let estadoPuntualidad: "puntual" | "tarde" | "sinVerificacion" = "sinVerificacion";
      let desviacion: number | null = null;
      if (hitoInicio !== undefined) {
        const programado = inicioProgramadoMs(servicio);
        desviacion = Math.round((hitoInicio.timestamp - programado) / 60_000);
        estadoPuntualidad =
          hitoInicio.timestamp <= programado + tolerancia ? "puntual" : "tarde";
      }
      filas.push({
        servicioId: servicio._id,
        clienteNombre: contexto?.cliente?.nombre ?? "(sin cliente)",
        fechaProgramada: servicio.fechaProgramada,
        horaInicioProgramada: servicio.horaInicioProgramada,
        estadoServicio: servicio.estado,
        estadoPuntualidad,
        minutosDesviacionInicio: desviacion,
      });
    }
    return filas;
  },
});

// ---------------------------------------------------------------------------
// 3. Flota con baja utilización
// ---------------------------------------------------------------------------

export const flotaConBajaUtilizacion = query({
  args: {
    desde: v.string(),
    hasta: v.string(),
    umbralServicios: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      vehiculoId: v.id("vehiculos"),
      placa: v.string(),
      tipoVehiculo: v.string(),
      propietarioNombre: v.string(),
      serviciosAsignados: v.number(),
      serviciosCompletados: v.number(),
      motivo: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const umbral = args.umbralServicios ?? 5;
    const vehiculos = await ctx.db
      .query("vehiculos")
      .withIndex("by_estado", (q) => q.eq("estado", "habilitado"))
      .collect();
    const filas = [];
    for (const vehiculo of vehiculos) {
      let asignados = 0;
      let completados = 0;
      for (const estado of ["confirmada", "completada"] as const) {
        const asignaciones = await ctx.db
          .query("asignacionesServicio")
          .withIndex("by_vehiculo_estado", (q) =>
            q.eq("vehiculoId", vehiculo._id).eq("estado", estado),
          )
          .collect();
        for (const asignacion of asignaciones) {
          const servicio = await ctx.db.get(asignacion.servicioId);
          if (servicio === null) continue;
          if (servicio.fechaProgramada < args.desde || servicio.fechaProgramada > args.hasta)
            continue;
          asignados += 1;
          if (servicio.estado === "completado") completados += 1;
        }
      }
      if (completados >= umbral) continue;
      const propietario = await ctx.db.get(vehiculo.propietarioId);
      filas.push({
        vehiculoId: vehiculo._id,
        placa: vehiculo.placa,
        tipoVehiculo: vehiculo.tipoVehiculo,
        propietarioNombre: propietario?.nombre ?? "(sin propietario)",
        serviciosAsignados: asignados,
        serviciosCompletados: completados,
        motivo: `${completados} servicio(s) completado(s) entre ${args.desde} y ${args.hasta} (umbral ${umbral})`,
      });
    }
    return filas.sort((a, b) => a.serviciosCompletados - b.serviciosCompletados);
  },
});

// ---------------------------------------------------------------------------
// 4. Conductores con incidencias recurrentes
// ---------------------------------------------------------------------------

export const conductoresConIncidenciasRecurrentes = query({
  args: {
    desde: v.optional(v.string()),
    hasta: v.optional(v.string()),
    minimoIncidencias: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      conductorId: v.id("conductores"),
      nombre: v.string(),
      totalIncidencias: v.number(),
      criticas: v.number(),
      porTipo: v.array(v.object({ tipo: v.string(), cantidad: v.number() })),
      motivo: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const hoy = hoyISO();
    const desde = args.desde ?? sumarDiasISO(hoy, -90);
    const hasta = args.hasta ?? hoy;
    const minimo = args.minimoIncidencias ?? 3;
    const conductores = await ctx.db
      .query("conductores")
      .withIndex("by_estado", (q) => q.eq("estado", "activo"))
      .collect();
    const filas = [];
    for (const conductor of conductores) {
      const porTipo = new Map<string, number>();
      let total = 0;
      let criticas = 0;
      for (const estado of ["confirmada", "completada"] as const) {
        const asignaciones = await ctx.db
          .query("asignacionesServicio")
          .withIndex("by_conductor_estado", (q) =>
            q.eq("conductorId", conductor._id).eq("estado", estado),
          )
          .collect();
        for (const asignacion of asignaciones) {
          const servicio = await ctx.db.get(asignacion.servicioId);
          if (servicio === null) continue;
          if (servicio.fechaProgramada < desde || servicio.fechaProgramada > hasta) continue;
          const incidencias = await ctx.db
            .query("incidencias")
            .withIndex("by_servicio", (q) => q.eq("servicioId", servicio._id))
            .collect();
          for (const incidencia of incidencias) {
            total += 1;
            if (incidencia.severidad === "critica") criticas += 1;
            porTipo.set(incidencia.tipo, (porTipo.get(incidencia.tipo) ?? 0) + 1);
          }
        }
      }
      if (total < minimo) continue;
      filas.push({
        conductorId: conductor._id,
        nombre: conductor.nombre,
        totalIncidencias: total,
        criticas,
        porTipo: [...porTipo.entries()].map(([tipo, cantidad]) => ({ tipo, cantidad })),
        motivo: `${total} incidencia(s) entre ${desde} y ${hasta} (${criticas} crítica(s))`,
      });
    }
    return filas.sort((a, b) => b.totalIncidencias - a.totalIncidencias);
  },
});

// ---------------------------------------------------------------------------
// 5. Gestores con desempeño deficiente
// ---------------------------------------------------------------------------

export const gestoresConDesempenoDeficiente = query({
  args: {},
  returns: v.array(
    v.object({
      gestorId: v.id("gestoresValidados"),
      nombre: v.string(),
      estado: v.string(),
      serviciosAsignados: v.number(),
      serviciosCompletados: v.number(),
      ratioCompletados: v.union(v.number(), v.null()),
      incidencias: v.number(),
      reemplazos: v.number(),
      checklistsRechazados: v.number(),
      motivo: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const gestores = await ctx.db
      .query("gestoresValidados")
      .withIndex("by_estado", (q) => q.eq("estado", "validado"))
      .collect();
    const filas = [];
    for (const gestor of gestores) {
      let asignados = 0;
      let completados = 0;
      let incidencias = 0;
      let reemplazos = 0;
      let checklistsRechazados = 0;
      for (const estado of [
        "propuesta",
        "confirmada",
        "rechazada",
        "reemplazada",
        "completada",
      ] as const) {
        const asignaciones = await ctx.db
          .query("asignacionesServicio")
          .withIndex("by_gestor_estado", (q) =>
            q.eq("gestorId", gestor._id).eq("estado", estado),
          )
          .collect();
        for (const asignacion of asignaciones) {
          asignados += 1;
          if (estado === "reemplazada") reemplazos += 1;
          if (estado === "completada") completados += 1;
          const incidenciasServicio = await ctx.db
            .query("incidencias")
            .withIndex("by_servicio", (q) => q.eq("servicioId", asignacion.servicioId))
            .collect();
          incidencias += incidenciasServicio.length;
          const checklists = await ctx.db
            .query("checklistsPreoperativos")
            .withIndex("by_servicio", (q) => q.eq("servicioId", asignacion.servicioId))
            .collect();
          checklistsRechazados += checklists.filter((c) => c.resultado === "rechazado").length;
        }
      }
      const ratio = asignados > 0 ? Math.round((completados / asignados) * 100) : null;
      const deficiente =
        (ratio !== null && ratio < 70) || reemplazos > 3 || incidencias > 5;
      if (!deficiente) continue;
      const motivos = [];
      if (ratio !== null && ratio < 70) motivos.push(`solo ${ratio}% completado`);
      if (reemplazos > 3) motivos.push(`${reemplazos} reemplazos`);
      if (incidencias > 5) motivos.push(`${incidencias} incidencias`);
      filas.push({
        gestorId: gestor._id,
        nombre: gestor.nombre,
        estado: gestor.estado,
        serviciosAsignados: asignados,
        serviciosCompletados: completados,
        ratioCompletados: ratio,
        incidencias,
        reemplazos,
        checklistsRechazados,
        motivo: motivos.join("; "),
      });
    }
    return filas;
  },
});

// ---------------------------------------------------------------------------
// 6. Clientes con mayor reproceso
// ---------------------------------------------------------------------------

export const clientesConMayorReproceso = query({
  args: {
    desde: v.optional(v.string()),
    hasta: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      clienteId: v.id("clientes"),
      clienteNombre: v.string(),
      totalServicios: v.number(),
      cancelados: v.number(),
      fallidos: v.number(),
      incidencias: v.number(),
      reemplazosAsignacion: v.number(),
      indiceReproceso: v.number(),
      motivo: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const hoy = hoyISO();
    const desde = args.desde ?? sumarDiasISO(hoy, -90);
    const hasta = args.hasta ?? hoy;
    const servicios = await serviciosEnRango(ctx, desde, hasta);
    const porCliente = new Map<
      string,
      {
        clienteId: Doc<"clientes">["_id"];
        clienteNombre: string;
        totalServicios: number;
        cancelados: number;
        fallidos: number;
        incidencias: number;
        reemplazosAsignacion: number;
      }
    >();
    for (const servicio of servicios) {
      const contexto = await contextoDeOperacion(ctx, servicio.operacionId);
      if (contexto?.cliente == null) continue;
      const cliente = contexto.cliente;
      const fila = porCliente.get(cliente._id) ?? {
        clienteId: cliente._id,
        clienteNombre: cliente.nombre,
        totalServicios: 0,
        cancelados: 0,
        fallidos: 0,
        incidencias: 0,
        reemplazosAsignacion: 0,
      };
      fila.totalServicios += 1;
      if (servicio.estado === "cancelado") fila.cancelados += 1;
      if (servicio.estado === "fallido") fila.fallidos += 1;
      const incidencias = await ctx.db
        .query("incidencias")
        .withIndex("by_servicio", (q) => q.eq("servicioId", servicio._id))
        .collect();
      fila.incidencias += incidencias.length;
      const reemplazadas = await ctx.db
        .query("asignacionesServicio")
        .withIndex("by_servicio_estado", (q) =>
          q.eq("servicioId", servicio._id).eq("estado", "reemplazada"),
        )
        .collect();
      fila.reemplazosAsignacion += reemplazadas.length;
      porCliente.set(cliente._id, fila);
    }
    const filas = [...porCliente.values()]
      .map((fila) => {
        const eventos =
          fila.cancelados + fila.fallidos + fila.incidencias + fila.reemplazosAsignacion;
        const indice =
          fila.totalServicios > 0 ? Math.round((eventos / fila.totalServicios) * 100) : 0;
        return {
          ...fila,
          indiceReproceso: indice,
          motivo: `${eventos} evento(s) de reproceso sobre ${fila.totalServicios} servicio(s)`,
        };
      })
      .filter((fila) => fila.indiceReproceso > 0);
    return filas.sort((a, b) => b.indiceReproceso - a.indiceReproceso);
  },
});

// ---------------------------------------------------------------------------
// 7. Rutas con baja ocupación
// ---------------------------------------------------------------------------

export const rutasConBajaOcupacion = query({
  args: {
    desde: v.string(),
    hasta: v.string(),
    umbralPorcentaje: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      rutaId: v.id("rutas"),
      rutaNombre: v.string(),
      tipoRuta: v.string(),
      totalServicios: v.number(),
      pasajerosReales: v.number(),
      capacidadTotal: v.union(v.number(), v.null()),
      utilizacionPorcentaje: v.union(v.number(), v.null()),
      motivo: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const umbral = args.umbralPorcentaje ?? 50;
    const rutas = [];
    for (const tipoRuta of [
      "laboral",
      "institucional",
      "comunidad",
      "evento",
      "intermunicipal",
      "otra",
    ] as const) {
      const grupo = await ctx.db
        .query("rutas")
        .withIndex("by_activa_tipo", (q) => q.eq("activa", true).eq("tipoRuta", tipoRuta))
        .collect();
      rutas.push(...grupo);
    }
    const filas = [];
    for (const ruta of rutas) {
      const servicios = await ctx.db
        .query("serviciosTransporte")
        .withIndex("by_ruta_fecha", (q) =>
          q.eq("rutaId", ruta._id).gte("fechaProgramada", args.desde).lte(
            "fechaProgramada",
            args.hasta,
          ),
        )
        .collect();
      if (servicios.length === 0) continue;
      const reales = servicios.reduce(
        (suma, servicio) => suma + (servicio.cantidadPasajerosReal ?? 0),
        0,
      );
      const capacidadTotal =
        ruta.capacidadObjetivo !== undefined
          ? ruta.capacidadObjetivo * servicios.length
          : null;
      const utilizacion =
        capacidadTotal !== null && capacidadTotal > 0
          ? Math.round((reales / capacidadTotal) * 100)
          : null;
      if (utilizacion === null || utilizacion >= umbral) continue;
      filas.push({
        rutaId: ruta._id,
        rutaNombre: ruta.nombre,
        tipoRuta: ruta.tipoRuta,
        totalServicios: servicios.length,
        pasajerosReales: reales,
        capacidadTotal,
        utilizacionPorcentaje: utilizacion,
        motivo: `ocupación ${utilizacion}% bajo el umbral ${umbral}%`,
      });
    }
    return filas.sort(
      (a, b) => (a.utilizacionPorcentaje ?? 0) - (b.utilizacionPorcentaje ?? 0),
    );
  },
});

// ---------------------------------------------------------------------------
// 8. Documentos críticos vencidos (bloquean operación)
// ---------------------------------------------------------------------------

export const documentosCriticosVencidos = query({
  args: {},
  returns: v.array(
    v.object({
      entidadTipo: v.string(),
      entidadNombre: v.string(),
      identificacion: v.string(),
      estadoEntidad: v.string(),
      documentosVencidos: v.array(
        v.object({ tipoDocumento: v.string(), fechaVencimiento: v.optional(v.string()) }),
      ),
      motivo: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const vencidos = await ctx.db
      .query("documentosCumplimiento")
      .withIndex("by_estado_vencimiento", (q) => q.eq("estado", "vencido"))
      .collect();
    type Fila = {
      entidadTipo: string;
      entidadNombre: string;
      identificacion: string;
      estadoEntidad: string;
      documentosVencidos: Array<{ tipoDocumento: string; fechaVencimiento?: string }>;
    };
    const porEntidad = new Map<string, Fila>();
    for (const documento of vencidos) {
      let clave = "";
      let fila: Fila | null = null;
      if (documento.entidadTipo === "conductor" && documento.conductorId !== undefined) {
        const conductor = await ctx.db.get(documento.conductorId);
        if (conductor === null || conductor.estado !== "activo") continue;
        clave = `c:${conductor._id}`;
        fila = porEntidad.get(clave) ?? {
          entidadTipo: "conductor",
          entidadNombre: conductor.nombre,
          identificacion: conductor.cedula,
          estadoEntidad: conductor.estado,
          documentosVencidos: [],
        };
      } else if (documento.entidadTipo === "vehiculo" && documento.vehiculoId !== undefined) {
        const vehiculo = await ctx.db.get(documento.vehiculoId);
        if (vehiculo === null || vehiculo.estado !== "habilitado") continue;
        clave = `v:${vehiculo._id}`;
        fila = porEntidad.get(clave) ?? {
          entidadTipo: "vehiculo",
          entidadNombre: `${vehiculo.marca} ${vehiculo.linea}`,
          identificacion: vehiculo.placa,
          estadoEntidad: vehiculo.estado,
          documentosVencidos: [],
        };
      } else if (
        documento.entidadTipo === "propietario" &&
        documento.propietarioId !== undefined
      ) {
        const propietario = await ctx.db.get(documento.propietarioId);
        if (propietario === null || propietario.estado !== "activo") continue;
        clave = `p:${propietario._id}`;
        fila = porEntidad.get(clave) ?? {
          entidadTipo: "propietario",
          entidadNombre: propietario.nombre,
          identificacion: propietario.cedulaONit,
          estadoEntidad: propietario.estado,
          documentosVencidos: [],
        };
      } else if (documento.entidadTipo === "gestor" && documento.gestorId !== undefined) {
        const gestor = await ctx.db.get(documento.gestorId);
        if (gestor === null || gestor.estado !== "validado") continue;
        clave = `g:${gestor._id}`;
        fila = porEntidad.get(clave) ?? {
          entidadTipo: "gestor",
          entidadNombre: gestor.nombre,
          identificacion: gestor.cedulaONit,
          estadoEntidad: gestor.estado,
          documentosVencidos: [],
        };
      }
      if (fila === null) continue;
      fila.documentosVencidos.push({
        tipoDocumento: documento.tipoDocumento,
        fechaVencimiento: documento.fechaVencimiento,
      });
      porEntidad.set(clave, fila);
    }
    return [...porEntidad.values()].map((fila) => ({
      ...fila,
      motivo: `${fila.documentosVencidos.length} documento(s) vencido(s) bloquean operación`,
    }));
  },
});
