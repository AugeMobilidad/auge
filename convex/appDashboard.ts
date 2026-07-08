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
// Verificación de Telegram
// ---------------------------------------------------------------------------

export const dashboardTelegramPendientes = query({
  args: {},
  returns: v.array(
    v.object({
      cuentaId: v.id("telegramCuentas"),
      telegramUserId: v.string(),
      telegramChatId: v.string(),
      username: v.optional(v.string()),
      telefono: v.optional(v.string()),
      solicitadaEn: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const cuentas = await ctx.db
      .query("telegramCuentas")
      .withIndex("by_estado", (q) => q.eq("estado", "pendienteVerificacion"))
      .collect();
    return cuentas
      .sort((a, b) => (b.fechaVinculacion ?? 0) - (a.fechaVinculacion ?? 0))
      .map((cuenta) => ({
        cuentaId: cuenta._id,
        telegramUserId: cuenta.telegramUserId,
        telegramChatId: cuenta.telegramChatId,
        username: cuenta.username,
        telefono: cuenta.telefono,
        solicitadaEn: cuenta.fechaVinculacion,
      }));
  },
});

export const dashboardTelegramCandidatos = query({
  args: {},
  returns: v.object({
    conductores: v.array(
      v.object({
        conductorId: v.id("conductores"),
        nombre: v.string(),
        cedula: v.string(),
        telefono: v.string(),
      }),
    ),
    usuariosSistema: v.array(
      v.object({
        usuarioSistemaId: v.id("usuariosSistema"),
        nombre: v.string(),
        tipoUsuario: v.string(),
        telefono: v.optional(v.string()),
        email: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx) => {
    const conductores = await ctx.db
      .query("conductores")
      .withIndex("by_estado", (q) => q.eq("estado", "activo"))
      .collect();
    const usuariosSistema = [];
    const tipos = [
      "operadorLogistico",
      "coordinador",
      "conductor",
      "propietario",
      "gestor",
      "cliente",
      "admin",
      "sistema",
    ] as const;
    for (const tipo of tipos) {
      const usuarios = await ctx.db
        .query("usuariosSistema")
        .withIndex("by_tipo_estado", (q) => q.eq("tipoUsuario", tipo).eq("estado", "activo"))
        .collect();
      usuariosSistema.push(...usuarios);
    }
    return {
      conductores: conductores
        .map((conductor) => ({
          conductorId: conductor._id,
          nombre: conductor.nombre,
          cedula: conductor.cedula,
          telefono: conductor.telefono,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
      usuariosSistema: usuariosSistema
        .map((usuario) => ({
          usuarioSistemaId: usuario._id,
          nombre: usuario.nombre,
          tipoUsuario: usuario.tipoUsuario,
          telefono: usuario.telefono,
          email: usuario.email,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
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

// Cota de filas leídas por servicio para el detalle: un servicio con miles de
// pings GPS o evidencias no debe forzar un scan completo solo para mostrar
// conteos y el último hito. Los conteos se marcan como "truncados" al tope.
const LIMITE_LECTURA_DETALLE = 100;

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
          asignacionId: v.id("asignacionesServicio"),
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
        puntosTruncados: v.boolean(),
        ultimoTimestamp: v.optional(v.number()),
        hitos: v.array(v.object({ evento: v.string(), timestamp: v.number() })),
      }),
      evidencias: v.number(),
      evidenciasTruncadas: v.boolean(),
      incidenciasAbiertas: v.number(),
      liquidacion: v.union(
        v.null(),
        v.object({
          liquidacionId: v.id("liquidaciones"),
          estado: v.string(),
          valorNeto: v.number(),
        }),
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
        asignacionId: asignacion._id,
        estado: asignacion.estado,
        vehiculoPlaca: vehiculo?.placa ?? "(?)",
        conductorNombre: conductor?.nombre ?? "(?)",
        conductorTelefono: conductor?.telefono ?? "",
        gestorNombre: gestor?.nombre,
      };
    }
    const checklist = await checklistAprobadoDeServicio(ctx, servicio._id);
    // Lectura acotada y descendente: basta la ventana más reciente para el
    // último timestamp y los hitos; no se escanea el histórico completo.
    const gpsRecientes = await ctx.db
      .query("seguimientosGps")
      .withIndex("by_servicio_timestamp", (q) => q.eq("servicioId", servicio._id))
      .order("desc")
      .take(LIMITE_LECTURA_DETALLE);
    const evidencias = await ctx.db
      .query("evidenciasServicio")
      .withIndex("by_servicio_timestamp", (q) => q.eq("servicioId", servicio._id))
      .order("desc")
      .take(LIMITE_LECTURA_DETALLE);
    const incidencias = await ctx.db
      .query("incidencias")
      .withIndex("by_servicio", (q) => q.eq("servicioId", servicio._id))
      .order("desc")
      .take(LIMITE_LECTURA_DETALLE);
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
        puntos: gpsRecientes.length,
        puntosTruncados: gpsRecientes.length === LIMITE_LECTURA_DETALLE,
        // gpsRecientes viene en orden descendente; el primero es el más reciente.
        ultimoTimestamp: gpsRecientes.length > 0 ? gpsRecientes[0].timestamp : undefined,
        hitos: gpsRecientes
          .filter((h) => h.evento !== "ubicacion")
          .map((h) => ({ evento: h.evento, timestamp: h.timestamp }))
          .sort((a, b) => a.timestamp - b.timestamp),
      },
      evidencias: evidencias.length,
      evidenciasTruncadas: evidencias.length === LIMITE_LECTURA_DETALLE,
      incidenciasAbiertas: incidencias.filter(
        (i) => i.estado === "abierta" || i.estado === "enGestion",
      ).length,
      liquidacion:
        liquidacion !== null
          ? {
              liquidacionId: liquidacion._id,
              estado: liquidacion.estado,
              valorNeto: liquidacion.valorNeto,
            }
          : null,
    };
  },
});

// ---------------------------------------------------------------------------
// Incidencias abiertas (cola de gestión)
// ---------------------------------------------------------------------------

export const dashboardIncidenciasAbiertas = query({
  args: {},
  returns: v.array(
    v.object({
      incidenciaId: v.id("incidencias"),
      servicioId: v.id("serviciosTransporte"),
      tipo: v.string(),
      severidad: v.string(),
      estado: v.string(),
      descripcion: v.string(),
      timestamp: v.number(),
      responsable: v.optional(v.string()),
      clienteNombre: v.string(),
      operacionNombre: v.string(),
      rutaTexto: v.string(),
      servicioFecha: v.string(),
      servicioEstado: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const filas = [];
    for (const estado of ["abierta", "enGestion"] as const) {
      const grupo = await ctx.db
        .query("incidencias")
        .withIndex("by_estado_timestamp", (q) => q.eq("estado", estado))
        .order("desc")
        .take(200);
      for (const incidencia of grupo) {
        const servicio = await ctx.db.get(incidencia.servicioId);
        const contexto =
          servicio !== null ? await contextoDeOperacion(ctx, servicio.operacionId) : null;
        filas.push({
          incidenciaId: incidencia._id,
          servicioId: incidencia.servicioId,
          tipo: incidencia.tipo,
          severidad: incidencia.severidad,
          estado: incidencia.estado,
          descripcion: incidencia.descripcion,
          timestamp: incidencia.timestamp,
          responsable: incidencia.responsable,
          clienteNombre: contexto?.cliente?.nombre ?? "(sin cliente)",
          operacionNombre: contexto?.operacion.nombre ?? "(sin operación)",
          rutaTexto:
            servicio !== null
              ? `${servicio.origenTexto} → ${servicio.destinoTexto}`
              : "(servicio no encontrado)",
          servicioFecha: servicio?.fechaProgramada ?? "",
          servicioEstado: servicio?.estado ?? "",
        });
      }
    }
    // Más severas y recientes primero.
    const rankSeveridad: Record<string, number> = { critica: 0, alta: 1, media: 2, baja: 3 };
    return filas.sort(
      (a, b) =>
        (rankSeveridad[a.severidad] ?? 9) - (rankSeveridad[b.severidad] ?? 9) ||
        b.timestamp - a.timestamp,
    );
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
// Documentos de cumplimiento próximos a vencer / vencidos (con id para gestión)
// ---------------------------------------------------------------------------

export const dashboardDocumentosProximosVencer = query({
  args: { diasVentana: v.optional(v.number()) },
  returns: v.array(
    v.object({
      documentoId: v.id("documentosCumplimiento"),
      entidadTipo: v.string(),
      entidadNombre: v.string(),
      identificacion: v.string(),
      tipoDocumento: v.string(),
      estado: v.string(),
      fechaVencimiento: v.optional(v.string()),
      diasRestantes: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const hoy = hoyISO();
    const limite = sumarDiasISO(hoy, args.diasVentana ?? 30);
    const relevantes: Array<Doc<"documentosCumplimiento">> = [];
    // Vencidos.
    relevantes.push(
      ...(await ctx.db
        .query("documentosCumplimiento")
        .withIndex("by_estado_vencimiento", (q) => q.eq("estado", "vencido"))
        .take(300)),
    );
    // Por vencer / vigentes dentro de la ventana.
    for (const estado of ["porVencer", "vigente"] as const) {
      relevantes.push(
        ...(await ctx.db
          .query("documentosCumplimiento")
          .withIndex("by_estado_vencimiento", (q) =>
            q.eq("estado", estado).gte("fechaVencimiento", hoy).lte("fechaVencimiento", limite),
          )
          .take(300)),
      );
    }

    const nombreEntidad = async (
      documento: Doc<"documentosCumplimiento">,
    ): Promise<{ nombre: string; ident: string }> => {
      if (documento.entidadTipo === "conductor" && documento.conductorId !== undefined) {
        const c = await ctx.db.get(documento.conductorId);
        return { nombre: c?.nombre ?? "(?)", ident: c?.cedula ?? "" };
      }
      if (documento.entidadTipo === "vehiculo" && documento.vehiculoId !== undefined) {
        const vh = await ctx.db.get(documento.vehiculoId);
        return { nombre: vh ? `${vh.marca} ${vh.linea}` : "(?)", ident: vh?.placa ?? "" };
      }
      if (documento.entidadTipo === "propietario" && documento.propietarioId !== undefined) {
        const p = await ctx.db.get(documento.propietarioId);
        return { nombre: p?.nombre ?? "(?)", ident: p?.cedulaONit ?? "" };
      }
      if (documento.entidadTipo === "gestor" && documento.gestorId !== undefined) {
        const g = await ctx.db.get(documento.gestorId);
        return { nombre: g?.nombre ?? "(?)", ident: g?.cedulaONit ?? "" };
      }
      return { nombre: "(sin entidad)", ident: "" };
    };

    const filas = [];
    for (const documento of relevantes) {
      const { nombre, ident } = await nombreEntidad(documento);
      const dias =
        documento.fechaVencimiento !== undefined
          ? Math.round(
              (new Date(`${documento.fechaVencimiento}T12:00:00Z`).getTime() -
                new Date(`${hoy}T12:00:00Z`).getTime()) /
                86_400_000,
            )
          : null;
      filas.push({
        documentoId: documento._id,
        entidadTipo: documento.entidadTipo,
        entidadNombre: nombre,
        identificacion: ident,
        tipoDocumento: documento.tipoDocumento,
        estado: documento.estado,
        fechaVencimiento: documento.fechaVencimiento,
        diasRestantes: dias,
      });
    }
    // Más urgente (menor días restantes) primero.
    return filas.sort((a, b) => (a.diasRestantes ?? 1e9) - (b.diasRestantes ?? 1e9));
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
