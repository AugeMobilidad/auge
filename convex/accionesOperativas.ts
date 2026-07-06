/**
 * Acciones operativas — mutations de capa de datos de la ontología.
 *
 * Todas las escrituras a los Objects/Links pasan por aquí. Cada mutation:
 * - valida transiciones de estado (no hay saltos inválidos),
 * - registra auditoría en `auditoriaAcciones`,
 * - lleva metadata de actor/origen para distinguir dashboard, Telegram y sistema.
 *
 * Las mutations `conductor*` (seguras para Telegram) y `dashboard*` comparten
 * los helpers internos de este archivo: la lógica de negocio vive una sola vez.
 *
 * Superficie pública vs interna:
 * - `dashboard*` exige actorUsuarioSistemaId + permiso; `conductor*` exige
 *   asignación propia del conductor. Son la superficie para las apps.
 * - Las mutations sin actor (creación de usuarios/roles, liquidaciones,
 *   auditoría manual, checklist/GPS/evidencia genéricos) son
 *   `internalMutation`: solo se invocan desde otras funciones Convex o con
 *   `npx convex run`, nunca desde clientes externos. Antes eran públicas y
 *   permitían, p.ej., crear un usuario admin sin autenticación.
 *
 * Reglas de flujo del servicio:
 *   programado → asignado          solo con asignación confirmada
 *   asignado   → enPreparacion     solo con cumplimiento vehículo/conductor válido
 *   enPreparacion → enCurso        solo con checklist aprobado(ConObservaciones)
 *   enCurso    → completado        solo con evidencia de cierre o nota de cierre
 *   cualquiera no terminal → cancelado/fallido con motivo
 */
import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { registrarAuditoria, type ActorAuditoria } from "./auditoria";
import {
  PERMISOS,
  requerirAsignacionDeConductor,
  requerirPermiso,
  resolverActorTelegram,
} from "./seguridad";
import {
  fechaISODeInstante,
  horaDeInstante,
  hoyISO,
  sumarDiasISO,
  ventanaDeServicio,
  ventanasSeSolapan,
} from "./lib/horarios";
// Nota: los validadores de args van SIEMPRE inline (sin consts compartidos ni
// spreads) porque convex-typegen parsea estos archivos estáticamente.
import {
  asignacionActivaDeServicio,
  checklistAprobadoDeServicio,
} from "./lib/consultas";

// ---------------------------------------------------------------------------
// Helpers generales
// ---------------------------------------------------------------------------

const ACTOR_SISTEMA: ActorAuditoria = { actorTipo: "sistema", origen: "convex" };

function actorUsuario(usuarioId: Id<"usuariosSistema">): ActorAuditoria {
  return { actorTipo: "usuario", actorId: usuarioId, origen: "webDashboard" };
}

function actorConductor(conductorId: Id<"conductores">): ActorAuditoria {
  return { actorTipo: "conductor", actorId: conductorId, origen: "telegramBot" };
}

type EstadoServicio = Doc<"serviciosTransporte">["estado"];

const TRANSICIONES_SERVICIO: Record<EstadoServicio, EstadoServicio[]> = {
  programado: ["asignado", "cancelado"],
  asignado: ["enPreparacion", "programado", "cancelado", "fallido"],
  enPreparacion: ["enCurso", "cancelado", "fallido"],
  enCurso: ["completado", "fallido"],
  completado: [],
  cancelado: [],
  fallido: [],
};

async function obtenerServicio(
  ctx: MutationCtx,
  servicioId: Id<"serviciosTransporte">,
): Promise<Doc<"serviciosTransporte">> {
  const servicio = await ctx.db.get(servicioId);
  if (servicio === null) throw new Error("Servicio no encontrado");
  return servicio;
}

async function transicionarServicio(
  ctx: MutationCtx,
  servicio: Doc<"serviciosTransporte">,
  nuevoEstado: EstadoServicio,
) {
  if (!TRANSICIONES_SERVICIO[servicio.estado].includes(nuevoEstado)) {
    throw new Error(
      `Transición inválida del servicio: ${servicio.estado} → ${nuevoEstado}`,
    );
  }
  await ctx.db.patch(servicio._id, { estado: nuevoEstado });
}

/** Motivos por los que el par vehículo/conductor NO cumple para operar. */
async function motivosIncumplimiento(
  ctx: MutationCtx,
  vehiculo: Doc<"vehiculos">,
  conductor: Doc<"conductores">,
): Promise<string[]> {
  const motivos: string[] = [];
  if (vehiculo.estado !== "habilitado") {
    motivos.push(`Vehículo ${vehiculo.placa} en estado ${vehiculo.estado}`);
  }
  if (conductor.estado !== "activo") {
    motivos.push(`Conductor ${conductor.nombre} en estado ${conductor.estado}`);
  }
  if (conductor.licenciaVence < hoyISO()) {
    motivos.push(
      `Licencia de ${conductor.nombre} vencida desde ${conductor.licenciaVence}`,
    );
  }
  const docsConductor = await ctx.db
    .query("documentosCumplimiento")
    .withIndex("by_conductor", (q) => q.eq("conductorId", conductor._id))
    .collect();
  const docsVehiculo = await ctx.db
    .query("documentosCumplimiento")
    .withIndex("by_vehiculo", (q) => q.eq("vehiculoId", vehiculo._id))
    .collect();
  for (const documento of [...docsConductor, ...docsVehiculo]) {
    if (documento.estado === "vencido") {
      motivos.push(
        `Documento ${documento.tipoDocumento} vencido (${documento.fechaVencimiento ?? "sin fecha"})`,
      );
    }
  }
  return motivos;
}

async function tieneConflictoDeAgenda(
  ctx: MutationCtx,
  servicio: Doc<"serviciosTransporte">,
  indice: "by_conductor_estado" | "by_vehiculo_estado",
  actorId: Id<"conductores"> | Id<"vehiculos">,
): Promise<boolean> {
  const confirmadas = await ctx.db
    .query("asignacionesServicio")
    .withIndex(indice, (q) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      q.eq(indice === "by_conductor_estado" ? "conductorId" : "vehiculoId", actorId as any).eq(
        "estado",
        "confirmada",
      ),
    )
    .collect();
  const ventana = ventanaDeServicio(servicio);
  for (const asignacion of confirmadas) {
    if (asignacion.servicioId === servicio._id) continue;
    const otro = await ctx.db.get(asignacion.servicioId);
    if (otro === null || otro.fechaProgramada !== servicio.fechaProgramada) continue;
    if (otro.estado === "cancelado" || otro.estado === "fallido" || otro.estado === "completado")
      continue;
    if (ventanasSeSolapan(ventana, ventanaDeServicio(otro))) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Helpers de dominio compartidos (dashboard + conductor/Telegram)
// ---------------------------------------------------------------------------

async function programarServicioHelper(
  ctx: MutationCtx,
  actor: ActorAuditoria,
  args: {
    operacionId: Id<"operaciones">;
    solicitudId?: Id<"solicitudesServicio">;
    rutaId?: Id<"rutas">;
    fechaProgramada: string;
    horaInicioProgramada: string;
    horaFinProgramada?: string;
    origenTexto: string;
    destinoTexto: string;
    origenGeo?: { lat: number; lng: number };
    destinoGeo?: { lat: number; lng: number };
    cantidadPasajerosProgramada?: number;
    tipoVehiculoRequerido: Doc<"serviciosTransporte">["tipoVehiculoRequerido"];
    prioridad?: Doc<"serviciosTransporte">["prioridad"];
    tarifaAcordada?: number;
    observaciones?: string;
  },
): Promise<Id<"serviciosTransporte">> {
  const operacion = await ctx.db.get(args.operacionId);
  if (operacion === null) throw new Error("Operación no encontrada");
  if (operacion.estado === "cerrada" || operacion.estado === "cancelada") {
    throw new Error(`La operación está ${operacion.estado}; no admite servicios nuevos`);
  }
  const servicioId = await ctx.db.insert("serviciosTransporte", {
    operacionId: args.operacionId,
    solicitudId: args.solicitudId,
    rutaId: args.rutaId,
    fechaProgramada: args.fechaProgramada,
    horaInicioProgramada: args.horaInicioProgramada,
    horaFinProgramada: args.horaFinProgramada,
    origenTexto: args.origenTexto,
    destinoTexto: args.destinoTexto,
    origenGeo: args.origenGeo,
    destinoGeo: args.destinoGeo,
    cantidadPasajerosProgramada: args.cantidadPasajerosProgramada,
    tipoVehiculoRequerido: args.tipoVehiculoRequerido,
    estado: "programado",
    prioridad: args.prioridad ?? "normal",
    tarifaAcordada: args.tarifaAcordada,
    observaciones: args.observaciones,
  });
  await registrarAuditoria(ctx, actor, {
    accion: "servicio.creado",
    entidadTipo: "serviciosTransporte",
    entidadId: servicioId,
    resultado: "ok",
    detalle: `${args.fechaProgramada} ${args.horaInicioProgramada} ${args.origenTexto} → ${args.destinoTexto}`,
  });
  return servicioId;
}

async function asignarHelper(
  ctx: MutationCtx,
  actor: ActorAuditoria,
  args: {
    servicioId: Id<"serviciosTransporte">;
    vehiculoId: Id<"vehiculos">;
    conductorId: Id<"conductores">;
    gestorId?: Id<"gestoresValidados">;
    asignadoPor: string;
    confirmarInmediato?: boolean;
  },
): Promise<Id<"asignacionesServicio">> {
  const servicio = await obtenerServicio(ctx, args.servicioId);
  if (servicio.estado !== "programado") {
    throw new Error(
      `Solo se asignan servicios en estado programado (actual: ${servicio.estado}); use reemplazarAsignacion`,
    );
  }
  const existente = await asignacionActivaDeServicio(ctx, args.servicioId, [
    "propuesta",
    "confirmada",
  ]);
  if (existente !== null) {
    throw new Error(
      `El servicio ya tiene una asignación ${existente.estado}; use reemplazarAsignacion`,
    );
  }
  const vehiculo = await ctx.db.get(args.vehiculoId);
  const conductor = await ctx.db.get(args.conductorId);
  if (vehiculo === null) throw new Error("Vehículo no encontrado");
  if (conductor === null) throw new Error("Conductor no encontrado");
  if (vehiculo.tipoVehiculo !== servicio.tipoVehiculoRequerido) {
    throw new Error(
      `El servicio requiere ${servicio.tipoVehiculoRequerido} y el vehículo ${vehiculo.placa} es ${vehiculo.tipoVehiculo}`,
    );
  }
  const motivos = await motivosIncumplimiento(ctx, vehiculo, conductor);
  if (motivos.length > 0) {
    throw new Error(`Cumplimiento inválido: ${motivos.join("; ")}`);
  }
  if (await tieneConflictoDeAgenda(ctx, servicio, "by_conductor_estado", args.conductorId)) {
    throw new Error(`El conductor ${conductor.nombre} tiene otra asignación en ese horario`);
  }
  if (await tieneConflictoDeAgenda(ctx, servicio, "by_vehiculo_estado", args.vehiculoId)) {
    throw new Error(`El vehículo ${vehiculo.placa} tiene otra asignación en ese horario`);
  }
  if (args.gestorId !== undefined) {
    const vinculoVehiculo = await ctx.db
      .query("vehiculosGestor")
      .withIndex("by_gestor_estado", (q) =>
        q.eq("gestorId", args.gestorId!).eq("estado", "activo"),
      )
      .collect();
    if (!vinculoVehiculo.some((vinculo) => vinculo.vehiculoId === args.vehiculoId)) {
      throw new Error("El vehículo no pertenece a la flota activa de ese gestor");
    }
    const vinculoConductor = await ctx.db
      .query("conductoresGestor")
      .withIndex("by_gestor_estado", (q) =>
        q.eq("gestorId", args.gestorId!).eq("estado", "activo"),
      )
      .collect();
    if (!vinculoConductor.some((vinculo) => vinculo.conductorId === args.conductorId)) {
      throw new Error("El conductor no está vinculado activo a ese gestor");
    }
  }
  const estado = args.confirmarInmediato === true ? "confirmada" : "propuesta";
  const asignacionId = await ctx.db.insert("asignacionesServicio", {
    servicioId: args.servicioId,
    vehiculoId: args.vehiculoId,
    conductorId: args.conductorId,
    gestorId: args.gestorId,
    asignadoPor: args.asignadoPor,
    fechaAsignacion: Date.now(),
    estado,
  });
  if (estado === "confirmada") {
    await transicionarServicio(ctx, servicio, "asignado");
  }
  await registrarAuditoria(ctx, actor, {
    accion: estado === "confirmada" ? "servicio.asignado" : "asignacion.propuesta",
    entidadTipo: "serviciosTransporte",
    entidadId: args.servicioId,
    resultado: "ok",
    detalle: `vehículo ${vehiculo.placa}, conductor ${conductor.nombre}`,
  });
  return asignacionId;
}

async function confirmarAsignacionHelper(
  ctx: MutationCtx,
  actor: ActorAuditoria,
  asignacion: Doc<"asignacionesServicio">,
): Promise<void> {
  if (asignacion.estado !== "propuesta") {
    throw new Error(`Solo se confirman asignaciones propuestas (actual: ${asignacion.estado})`);
  }
  const servicio = await obtenerServicio(ctx, asignacion.servicioId);
  await ctx.db.patch(asignacion._id, { estado: "confirmada" });
  if (servicio.estado === "programado") {
    await transicionarServicio(ctx, servicio, "asignado");
  }
  await registrarAuditoria(ctx, actor, {
    accion: "asignacion.confirmada",
    entidadTipo: "asignacionesServicio",
    entidadId: asignacion._id,
    resultado: "ok",
  });
}

async function reemplazarAsignacionHelper(
  ctx: MutationCtx,
  actor: ActorAuditoria,
  args: {
    servicioId: Id<"serviciosTransporte">;
    vehiculoId: Id<"vehiculos">;
    conductorId: Id<"conductores">;
    gestorId?: Id<"gestoresValidados">;
    asignadoPor: string;
    motivoReemplazo: string;
    confirmarInmediato?: boolean;
  },
): Promise<Id<"asignacionesServicio">> {
  const servicio = await obtenerServicio(ctx, args.servicioId);
  if (servicio.estado === "completado" || servicio.estado === "cancelado" || servicio.estado === "fallido") {
    throw new Error(`El servicio está ${servicio.estado}; no admite reasignación`);
  }
  const actual = await asignacionActivaDeServicio(ctx, args.servicioId, [
    "confirmada",
    "propuesta",
  ]);
  if (actual === null) {
    throw new Error("El servicio no tiene asignación activa; use asignarVehiculoYConductor");
  }
  await ctx.db.patch(actual._id, {
    estado: "reemplazada",
    motivoReemplazo: args.motivoReemplazo,
  });
  // El servicio vuelve a programado mientras la nueva asignación se confirma.
  if (servicio.estado !== "programado") {
    await ctx.db.patch(servicio._id, { estado: "programado" });
  }
  await registrarAuditoria(ctx, actor, {
    accion: "asignacion.reemplazada",
    entidadTipo: "serviciosTransporte",
    entidadId: args.servicioId,
    resultado: "ok",
    detalle: args.motivoReemplazo,
  });
  // asignarHelper relee el servicio, así que ve el estado "programado" recién escrito.
  return await asignarHelper(ctx, actor, args);
}

async function registrarChecklistHelper(
  ctx: MutationCtx,
  actor: ActorAuditoria,
  args: {
    servicioId: Id<"serviciosTransporte">;
    vehiculoId: Id<"vehiculos">;
    conductorId: Id<"conductores">;
    combustibleOk: boolean;
    llantasOk: boolean;
    lucesOk: boolean;
    documentosOk: boolean;
    limpiezaOk: boolean;
    gpsOk: boolean;
    observaciones?: string;
  },
): Promise<Id<"checklistsPreoperativos">> {
  const servicio = await obtenerServicio(ctx, args.servicioId);
  if (servicio.estado !== "asignado" && servicio.estado !== "enPreparacion") {
    throw new Error(
      `El checklist se registra con el servicio asignado o en preparación (actual: ${servicio.estado})`,
    );
  }
  const asignacion = await asignacionActivaDeServicio(ctx, args.servicioId, ["confirmada"]);
  if (asignacion === null) throw new Error("El servicio no tiene asignación confirmada");
  if (asignacion.vehiculoId !== args.vehiculoId || asignacion.conductorId !== args.conductorId) {
    throw new Error("El checklist no corresponde al vehículo/conductor asignados");
  }
  const items = [
    args.combustibleOk,
    args.llantasOk,
    args.lucesOk,
    args.documentosOk,
    args.limpiezaOk,
    args.gpsOk,
  ];
  const fallas = items.filter((ok) => !ok).length;
  const resultado =
    fallas === 0
      ? "aprobado"
      : fallas <= 1 && args.documentosOk && args.llantasOk && args.lucesOk
        ? "aprobadoConObservaciones"
        : "rechazado";

  // asignado → enPreparacion exige checklist no rechazado y cumplimiento
  // válido de vehículo/conductor. Un checklist rechazado se registra pero deja
  // el servicio en `asignado` para que se corrija y se reintente.
  if (servicio.estado === "asignado" && resultado !== "rechazado") {
    const vehiculo = await ctx.db.get(args.vehiculoId);
    const conductor = await ctx.db.get(args.conductorId);
    if (vehiculo === null || conductor === null) {
      throw new Error("Vehículo o conductor no encontrado");
    }
    const motivos = await motivosIncumplimiento(ctx, vehiculo, conductor);
    if (motivos.length > 0) {
      throw new Error(`Cumplimiento inválido para preparar el servicio: ${motivos.join("; ")}`);
    }
    await transicionarServicio(ctx, servicio, "enPreparacion");
  }

  const checklistId = await ctx.db.insert("checklistsPreoperativos", {
    servicioId: args.servicioId,
    vehiculoId: args.vehiculoId,
    conductorId: args.conductorId,
    fecha: Date.now(),
    combustibleOk: args.combustibleOk,
    llantasOk: args.llantasOk,
    lucesOk: args.lucesOk,
    documentosOk: args.documentosOk,
    limpiezaOk: args.limpiezaOk,
    gpsOk: args.gpsOk,
    observaciones: args.observaciones,
    resultado,
  });
  await registrarAuditoria(ctx, actor, {
    accion: "checklist.registrado",
    entidadTipo: "serviciosTransporte",
    entidadId: args.servicioId,
    resultado: "ok",
    detalle: `resultado: ${resultado}`,
  });
  return checklistId;
}

async function iniciarServicioHelper(
  ctx: MutationCtx,
  actor: ActorAuditoria,
  args: {
    servicioId: Id<"serviciosTransporte">;
    geo?: { lat: number; lng: number };
    fuente?: Doc<"seguimientosGps">["fuente"];
  },
): Promise<void> {
  const servicio = await obtenerServicio(ctx, args.servicioId);
  if (servicio.estado !== "enPreparacion") {
    throw new Error(
      `El servicio debe estar en preparación para iniciar (actual: ${servicio.estado})`,
    );
  }
  const checklist = await checklistAprobadoDeServicio(ctx, args.servicioId);
  if (checklist === null) {
    throw new Error("No hay checklist preoperativo aprobado para este servicio");
  }
  const asignacion = await asignacionActivaDeServicio(ctx, args.servicioId, ["confirmada"]);
  if (asignacion === null) throw new Error("El servicio no tiene asignación confirmada");
  const ahora = Date.now();
  await transicionarServicio(ctx, servicio, "enCurso");
  // Hito real denormalizado: la puntualidad se mide contra este campo.
  await ctx.db.patch(servicio._id, { inicioRealTimestamp: ahora });
  if (args.geo !== undefined) {
    await ctx.db.insert("seguimientosGps", {
      servicioId: args.servicioId,
      vehiculoId: asignacion.vehiculoId,
      conductorId: asignacion.conductorId,
      timestamp: ahora,
      lat: args.geo.lat,
      lng: args.geo.lng,
      fuente: args.fuente ?? "manual",
      evento: "inicio",
    });
  }
  await registrarAuditoria(ctx, actor, {
    accion: "servicio.iniciado",
    entidadTipo: "serviciosTransporte",
    entidadId: args.servicioId,
    resultado: "ok",
  });
}

async function registrarGpsHelper(
  ctx: MutationCtx,
  actor: ActorAuditoria,
  args: {
    servicioId: Id<"serviciosTransporte">;
    lat: number;
    lng: number;
    velocidad?: number;
    fuente: Doc<"seguimientosGps">["fuente"];
    evento: Doc<"seguimientosGps">["evento"];
  },
): Promise<Id<"seguimientosGps">> {
  const servicio = await obtenerServicio(ctx, args.servicioId);
  if (servicio.estado !== "enCurso" && servicio.estado !== "enPreparacion") {
    throw new Error(`El servicio no está en curso (actual: ${servicio.estado})`);
  }
  const asignacion = await asignacionActivaDeServicio(ctx, args.servicioId, ["confirmada"]);
  if (asignacion === null) throw new Error("El servicio no tiene asignación confirmada");
  const seguimientoId = await ctx.db.insert("seguimientosGps", {
    servicioId: args.servicioId,
    vehiculoId: asignacion.vehiculoId,
    conductorId: asignacion.conductorId,
    timestamp: Date.now(),
    lat: args.lat,
    lng: args.lng,
    velocidad: args.velocidad,
    fuente: args.fuente,
    evento: args.evento,
  });
  // Solo los hitos (no cada ubicación) van a auditoría para no inundarla.
  if (args.evento !== "ubicacion") {
    await registrarAuditoria(ctx, actor, {
      accion: "gps.evento",
      entidadTipo: "serviciosTransporte",
      entidadId: args.servicioId,
      resultado: "ok",
      detalle: args.evento,
    });
  }
  return seguimientoId;
}

async function registrarEvidenciaHelper(
  ctx: MutationCtx,
  actor: ActorAuditoria,
  args: {
    servicioId: Id<"serviciosTransporte">;
    tipo: Doc<"evidenciasServicio">["tipo"];
    descripcion: string;
    archivoUrl?: string;
    creadoPorTipo: Doc<"evidenciasServicio">["creadoPorTipo"];
    creadoPorId?: string;
  },
): Promise<Id<"evidenciasServicio">> {
  const servicio = await obtenerServicio(ctx, args.servicioId);
  if (servicio.estado === "cancelado" || servicio.estado === "fallido") {
    throw new Error(`El servicio está ${servicio.estado}; no admite evidencias`);
  }
  const evidenciaId = await ctx.db.insert("evidenciasServicio", {
    servicioId: args.servicioId,
    tipo: args.tipo,
    descripcion: args.descripcion,
    archivoUrl: args.archivoUrl,
    creadoPorTipo: args.creadoPorTipo,
    creadoPorId: args.creadoPorId,
    timestamp: Date.now(),
  });
  await registrarAuditoria(ctx, actor, {
    accion: "evidencia.registrada",
    entidadTipo: "serviciosTransporte",
    entidadId: args.servicioId,
    resultado: "ok",
    detalle: args.tipo,
  });
  return evidenciaId;
}

async function registrarIncidenciaHelper(
  ctx: MutationCtx,
  actor: ActorAuditoria,
  args: {
    servicioId: Id<"serviciosTransporte">;
    tipo: Doc<"incidencias">["tipo"];
    severidad: Doc<"incidencias">["severidad"];
    descripcion: string;
    responsable?: string;
  },
): Promise<Id<"incidencias">> {
  const servicio = await obtenerServicio(ctx, args.servicioId);
  const incidenciaId = await ctx.db.insert("incidencias", {
    servicioId: args.servicioId,
    operacionId: servicio.operacionId,
    tipo: args.tipo,
    severidad: args.severidad,
    descripcion: args.descripcion,
    timestamp: Date.now(),
    estado: "abierta",
    responsable: args.responsable,
  });
  await registrarAuditoria(ctx, actor, {
    accion: "incidencia.abierta",
    entidadTipo: "incidencias",
    entidadId: incidenciaId,
    resultado: "ok",
    detalle: `${args.tipo} / severidad ${args.severidad} / servicio ${args.servicioId}`,
  });
  return incidenciaId;
}

async function resolverIncidenciaHelper(
  ctx: MutationCtx,
  actor: ActorAuditoria,
  args: {
    incidenciaId: Id<"incidencias">;
    accionCorrectiva: string;
    responsable?: string;
    cerrar?: boolean;
  },
): Promise<void> {
  const incidencia = await ctx.db.get(args.incidenciaId);
  if (incidencia === null) throw new Error("Incidencia no encontrada");
  if (incidencia.estado === "resuelta" || incidencia.estado === "cerrada") {
    throw new Error(`La incidencia ya está ${incidencia.estado}`);
  }
  await ctx.db.patch(args.incidenciaId, {
    estado: args.cerrar === true ? "cerrada" : "resuelta",
    accionCorrectiva: args.accionCorrectiva,
    responsable: args.responsable ?? incidencia.responsable,
    cerradaEn: args.cerrar === true ? Date.now() : undefined,
  });
  await registrarAuditoria(ctx, actor, {
    accion: "incidencia.resuelta",
    entidadTipo: "incidencias",
    entidadId: args.incidenciaId,
    resultado: "ok",
    detalle: args.accionCorrectiva,
  });
}

async function cerrarServicioHelper(
  ctx: MutationCtx,
  actor: ActorAuditoria,
  args: {
    servicioId: Id<"serviciosTransporte">;
    notaCierre?: string;
    cantidadPasajerosReal?: number;
    geo?: { lat: number; lng: number };
    fuente?: Doc<"seguimientosGps">["fuente"];
    creadoPorTipo?: Doc<"evidenciasServicio">["creadoPorTipo"];
    creadoPorId?: string;
  },
): Promise<void> {
  const servicio = await obtenerServicio(ctx, args.servicioId);
  if (servicio.estado !== "enCurso") {
    throw new Error(`Solo se cierran servicios en curso (actual: ${servicio.estado})`);
  }
  const asignacion = await asignacionActivaDeServicio(ctx, args.servicioId, ["confirmada"]);
  if (asignacion === null) {
    throw new Error(
      "El servicio no tiene asignación confirmada; márquelo cancelado o fallido",
    );
  }
  const evidencias = await ctx.db
    .query("evidenciasServicio")
    .withIndex("by_servicio_timestamp", (q) => q.eq("servicioId", args.servicioId))
    .collect();
  if (evidencias.length === 0 && (args.notaCierre === undefined || args.notaCierre === "")) {
    throw new Error(
      "Para completar el servicio se exige al menos una evidencia o una nota de cierre",
    );
  }
  if (args.notaCierre !== undefined && args.notaCierre !== "") {
    await ctx.db.insert("evidenciasServicio", {
      servicioId: args.servicioId,
      tipo: "comentario",
      descripcion: `Nota de cierre: ${args.notaCierre}`,
      creadoPorTipo: args.creadoPorTipo ?? "sistema",
      creadoPorId: args.creadoPorId,
      timestamp: Date.now(),
    });
  }
  if (args.geo !== undefined) {
    await ctx.db.insert("seguimientosGps", {
      servicioId: args.servicioId,
      vehiculoId: asignacion.vehiculoId,
      conductorId: asignacion.conductorId,
      timestamp: Date.now(),
      lat: args.geo.lat,
      lng: args.geo.lng,
      fuente: args.fuente ?? "manual",
      evento: "finalizacion",
    });
  }
  await transicionarServicio(ctx, servicio, "completado");
  await ctx.db.patch(asignacion._id, { estado: "completada" });
  await ctx.db.patch(args.servicioId, {
    finRealTimestamp: Date.now(),
    ...(args.cantidadPasajerosReal !== undefined
      ? { cantidadPasajerosReal: args.cantidadPasajerosReal }
      : {}),
  });
  await registrarAuditoria(ctx, actor, {
    accion: "servicio.completado",
    entidadTipo: "serviciosTransporte",
    entidadId: args.servicioId,
    resultado: "ok",
    detalle: args.notaCierre,
  });
}

async function cancelarServicioHelper(
  ctx: MutationCtx,
  actor: ActorAuditoria,
  args: {
    servicioId: Id<"serviciosTransporte">;
    motivo: string;
    marcarFallido?: boolean;
  },
): Promise<void> {
  const servicio = await obtenerServicio(ctx, args.servicioId);
  const destino: EstadoServicio = args.marcarFallido === true ? "fallido" : "cancelado";
  if (destino === "fallido" && servicio.estado === "programado") {
    throw new Error("Un servicio sin asignación se cancela, no se marca fallido");
  }
  await transicionarServicio(ctx, servicio, destino);
  await ctx.db.patch(args.servicioId, {
    observaciones: `${servicio.observaciones ?? ""}\n[${destino}] ${args.motivo}`.trim(),
  });
  // Cierra la asignación activa: sin esto quedaría "confirmada" para siempre y
  // seguiría contando en chequeos de agenda y autorizando al conductor.
  const asignacion = await asignacionActivaDeServicio(ctx, args.servicioId, [
    "propuesta",
    "confirmada",
  ]);
  if (asignacion !== null) {
    await ctx.db.patch(asignacion._id, {
      estado: "cancelada",
      motivoReemplazo: `[servicio ${destino}] ${args.motivo}`,
    });
  }
  await registrarAuditoria(ctx, actor, {
    accion: destino === "fallido" ? "servicio.fallido" : "servicio.cancelado",
    entidadTipo: "serviciosTransporte",
    entidadId: args.servicioId,
    resultado: "ok",
    detalle: args.motivo,
  });
}

/**
 * Resuelve el conductor que actúa desde Telegram o por id directo.
 *
 * ADVERTENCIA de confianza: la rama `conductorId` existe para la fachada Rust
 * `conductor_app` (app nativa futura) y confía en el id que envía el cliente.
 * Cuando haya auth real, esta rama debe derivar el conductor de
 * `ctx.auth.getUserIdentity()` en vez de un argumento.
 */
async function resolverConductorActor(
  ctx: MutationCtx,
  args: { telegramUserId?: string; conductorId?: Id<"conductores"> },
): Promise<{ conductor: Doc<"conductores">; actor: ActorAuditoria }> {
  if (args.telegramUserId !== undefined) {
    const contexto = await resolverActorTelegram(ctx, args.telegramUserId);
    if (contexto === null || contexto.conductor === null) {
      throw new Error("Cuenta de Telegram no vinculada a un conductor");
    }
    return {
      conductor: contexto.conductor,
      actor: {
        actorTipo: "telegram",
        actorId: contexto.cuenta._id,
        origen: "telegramBot",
      },
    };
  }
  if (args.conductorId === undefined) {
    throw new Error("Se requiere telegramUserId o conductorId");
  }
  const conductor = await ctx.db.get(args.conductorId);
  if (conductor === null) throw new Error("Conductor no encontrado");
  return { conductor, actor: actorConductor(conductor._id) };
}

// ---------------------------------------------------------------------------
// Mutations — creación de objetos comerciales/operativos
// ---------------------------------------------------------------------------

export const crearCliente = internalMutation({
  args: {
    nombre: v.string(),
    tipo: v.union(
      v.literal("empresa"),
      v.literal("institucion"),
      v.literal("comunidad"),
      v.literal("evento"),
      v.literal("persona"),
    ),
    nit: v.optional(v.string()),
    contactoPrincipal: v.string(),
    telefono: v.string(),
    email: v.string(),
    direccion: v.string(),
    ciudad: v.string(),
    notas: v.optional(v.string()),
  },
  returns: v.id("clientes"),
  handler: async (ctx, args) => {
    const clienteId = await ctx.db.insert("clientes", { ...args, estado: "activo" });
    await registrarAuditoria(ctx, ACTOR_SISTEMA, {
      accion: "cliente.creado",
      entidadTipo: "clientes",
      entidadId: clienteId,
      resultado: "ok",
      detalle: args.nombre,
    });
    return clienteId;
  },
});

export const crearProgramaMovilidad = internalMutation({
  args: {
    clienteId: v.id("clientes"),
    tipoServicio: v.union(
      v.literal("puntual"),
      v.literal("recurrente"),
      v.literal("gestorValidado"),
      v.literal("evento"),
      v.literal("comunidad"),
    ),
    nombre: v.string(),
    descripcion: v.string(),
    fechaInicio: v.string(),
    fechaFin: v.optional(v.string()),
    modalidadPago: v.union(v.literal("prepago"), v.literal("credito"), v.literal("mixto")),
    requiereReportePeriodico: v.boolean(),
    reglasOperativas: v.optional(v.string()),
  },
  returns: v.id("programasMovilidad"),
  handler: async (ctx, args) => {
    const cliente = await ctx.db.get(args.clienteId);
    if (cliente === null) throw new Error("Cliente no encontrado");
    if (cliente.estado !== "activo") throw new Error("El cliente está inactivo");
    const programaId = await ctx.db.insert("programasMovilidad", {
      ...args,
      estado: "borrador",
    });
    await registrarAuditoria(ctx, ACTOR_SISTEMA, {
      accion: "programa.creado",
      entidadTipo: "programasMovilidad",
      entidadId: programaId,
      resultado: "ok",
      detalle: `${args.nombre} (${args.tipoServicio}) para ${cliente.nombre}`,
    });
    return programaId;
  },
});

export const registrarSolicitudServicio = mutation({
  args: {
    clienteId: v.id("clientes"),
    programaId: v.optional(v.id("programasMovilidad")),
    tipoServicio: v.union(
      v.literal("puntual"),
      v.literal("recurrente"),
      v.literal("gestorValidado"),
      v.literal("evento"),
      v.literal("comunidad"),
    ),
    origenTexto: v.optional(v.string()),
    destinoTexto: v.optional(v.string()),
    fechaHoraRequerida: v.optional(v.number()),
    cantidadPasajerosEstimada: v.optional(v.number()),
    tipoVehiculoRequerido: v.optional(
      v.union(
        v.literal("automovil"),
        v.literal("van"),
        v.literal("buseta"),
        v.literal("bus"),
        v.literal("camioneta"),
        v.literal("otro"),
      ),
    ),
    requisitosEspeciales: v.optional(v.string()),
  },
  returns: v.id("solicitudesServicio"),
  handler: async (ctx, args) => {
    const cliente = await ctx.db.get(args.clienteId);
    if (cliente === null) throw new Error("Cliente no encontrado");
    const solicitudId = await ctx.db.insert("solicitudesServicio", {
      ...args,
      fechaSolicitud: Date.now(),
      estado: "recibida",
    });
    await registrarAuditoria(ctx, ACTOR_SISTEMA, {
      accion: "solicitud.registrada",
      entidadTipo: "solicitudesServicio",
      entidadId: solicitudId,
      resultado: "ok",
      detalle: `${cliente.nombre}: ${args.origenTexto ?? "?"} → ${args.destinoTexto ?? "?"}`,
    });
    return solicitudId;
  },
});

export const convertirSolicitudEnOperacionOServicio = mutation({
  args: {
    solicitudId: v.id("solicitudesServicio"),
    // Si se pasa, el servicio se cuelga de esta operación existente;
    // si no, se crea una operación nueva con estos datos.
    operacionId: v.optional(v.id("operaciones")),
    nombreOperacion: v.optional(v.string()),
    nivelControl: v.optional(
      v.union(v.literal("basico"), v.literal("controlado"), v.literal("comandoOperativo")),
    ),
    // Overrides de programación del servicio (si la solicitud no basta).
    fechaProgramada: v.optional(v.string()),
    horaInicioProgramada: v.optional(v.string()),
  },
  returns: v.object({
    operacionId: v.id("operaciones"),
    servicioId: v.optional(v.id("serviciosTransporte")),
  }),
  handler: async (ctx, args) => {
    const solicitud = await ctx.db.get(args.solicitudId);
    if (solicitud === null) throw new Error("Solicitud no encontrada");
    if (solicitud.estado === "rechazada" || solicitud.estado === "convertidaEnOperacion") {
      throw new Error(`La solicitud ya está ${solicitud.estado}`);
    }

    let operacionId = args.operacionId;
    if (operacionId === undefined) {
      if (solicitud.programaId === undefined) {
        throw new Error(
          "La solicitud no tiene programa; pase operacionId o asocie un programa primero",
        );
      }
      const cliente = await ctx.db.get(solicitud.clienteId);
      operacionId = await ctx.db.insert("operaciones", {
        programaId: solicitud.programaId,
        nombre:
          args.nombreOperacion ??
          `Operación ${solicitud.tipoServicio} — ${cliente?.nombre ?? "cliente"}`,
        tipoOperacion: solicitud.tipoServicio,
        fechaInicio: hoyISO(),
        estado: "planificada",
        nivelControl: args.nivelControl ?? "basico",
        requiereCentroControl: false,
      });
      await registrarAuditoria(ctx, ACTOR_SISTEMA, {
        accion: "operacion.creada",
        entidadTipo: "operaciones",
        entidadId: operacionId,
        resultado: "ok",
        detalle: `desde solicitud ${args.solicitudId}`,
      });
    }

    // Se programa el servicio si hay datos suficientes. La fecha/hora de
    // calendario se deriva en hora de Colombia (no UTC): un instante de las
    // 8 p.m. en Bogotá es la 1 a.m. UTC del día siguiente.
    let servicioId: Id<"serviciosTransporte"> | undefined;
    const requerida = solicitud.fechaHoraRequerida;
    const fecha =
      args.fechaProgramada ??
      (requerida !== undefined ? fechaISODeInstante(requerida) : undefined);
    const hora =
      args.horaInicioProgramada ??
      (requerida !== undefined ? horaDeInstante(requerida) : undefined);
    if (
      fecha !== undefined &&
      hora !== undefined &&
      solicitud.origenTexto !== undefined &&
      solicitud.destinoTexto !== undefined
    ) {
      servicioId = await programarServicioHelper(ctx, ACTOR_SISTEMA, {
        operacionId,
        solicitudId: args.solicitudId,
        fechaProgramada: fecha,
        horaInicioProgramada: hora,
        origenTexto: solicitud.origenTexto,
        destinoTexto: solicitud.destinoTexto,
        cantidadPasajerosProgramada: solicitud.cantidadPasajerosEstimada,
        tipoVehiculoRequerido: solicitud.tipoVehiculoRequerido ?? "van",
      });
    }

    await ctx.db.patch(args.solicitudId, { estado: "convertidaEnOperacion" });
    await registrarAuditoria(ctx, ACTOR_SISTEMA, {
      accion: "solicitud.convertida",
      entidadTipo: "solicitudesServicio",
      entidadId: args.solicitudId,
      resultado: "ok",
      detalle: servicioId !== undefined ? `servicio ${servicioId}` : "solo operación",
    });
    return { operacionId, servicioId };
  },
});

export const crearOperacion = mutation({
  args: {
    programaId: v.id("programasMovilidad"),
    nombre: v.string(),
    tipoOperacion: v.union(
      v.literal("puntual"),
      v.literal("recurrente"),
      v.literal("gestorValidado"),
      v.literal("evento"),
      v.literal("comunidad"),
    ),
    ciudadBase: v.optional(v.string()),
    zonaOperacion: v.optional(v.string()),
    fechaInicio: v.string(),
    fechaFin: v.optional(v.string()),
    responsableOperativo: v.optional(v.string()),
    nivelControl: v.union(
      v.literal("basico"),
      v.literal("controlado"),
      v.literal("comandoOperativo"),
    ),
    requiereCentroControl: v.boolean(),
  },
  returns: v.id("operaciones"),
  handler: async (ctx, args) => {
    const programa = await ctx.db.get(args.programaId);
    if (programa === null) throw new Error("Programa no encontrado");
    if (programa.estado === "cerrado") throw new Error("El programa está cerrado");
    const operacionId = await ctx.db.insert("operaciones", {
      ...args,
      estado: "planificada",
    });
    await registrarAuditoria(ctx, ACTOR_SISTEMA, {
      accion: "operacion.creada",
      entidadTipo: "operaciones",
      entidadId: operacionId,
      resultado: "ok",
      detalle: args.nombre,
    });
    return operacionId;
  },
});

export const crearRuta = mutation({
  args: {
    programaId: v.id("programasMovilidad"),
    nombre: v.string(),
    tipoRuta: v.union(
      v.literal("laboral"),
      v.literal("institucional"),
      v.literal("comunidad"),
      v.literal("evento"),
      v.literal("intermunicipal"),
      v.literal("otra"),
    ),
    origenPrincipal: v.string(),
    destinoPrincipal: v.string(),
    frecuencia: v.union(
      v.literal("unica"),
      v.literal("diaria"),
      v.literal("semanal"),
      v.literal("personalizada"),
    ),
    capacidadObjetivo: v.optional(v.number()),
    reglasAbordaje: v.optional(v.string()),
  },
  returns: v.id("rutas"),
  handler: async (ctx, args) => {
    const programa = await ctx.db.get(args.programaId);
    if (programa === null) throw new Error("Programa no encontrado");
    const rutaId = await ctx.db.insert("rutas", { ...args, activa: true });
    await registrarAuditoria(ctx, ACTOR_SISTEMA, {
      accion: "ruta.creada",
      entidadTipo: "rutas",
      entidadId: rutaId,
      resultado: "ok",
      detalle: args.nombre,
    });
    return rutaId;
  },
});

export const crearParada = mutation({
  args: {
    rutaId: v.id("rutas"),
    nombre: v.string(),
    orden: v.number(),
    direccionTexto: v.string(),
    geo: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    ventanaInicio: v.optional(v.string()),
    ventanaFin: v.optional(v.string()),
  },
  returns: v.id("paradas"),
  handler: async (ctx, args) => {
    const ruta = await ctx.db.get(args.rutaId);
    if (ruta === null) throw new Error("Ruta no encontrada");
    const paradaId = await ctx.db.insert("paradas", { ...args, activa: true });
    await registrarAuditoria(ctx, ACTOR_SISTEMA, {
      accion: "parada.creada",
      entidadTipo: "paradas",
      entidadId: paradaId,
      resultado: "ok",
      detalle: `${ruta.nombre} #${args.orden} ${args.nombre}`,
    });
    return paradaId;
  },
});

export const programarServicio = mutation({
  args: {
    operacionId: v.id("operaciones"),
    solicitudId: v.optional(v.id("solicitudesServicio")),
    rutaId: v.optional(v.id("rutas")),
    fechaProgramada: v.string(),
    horaInicioProgramada: v.string(),
    horaFinProgramada: v.optional(v.string()),
    origenTexto: v.string(),
    destinoTexto: v.string(),
    origenGeo: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    destinoGeo: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    cantidadPasajerosProgramada: v.optional(v.number()),
    tipoVehiculoRequerido: v.union(
      v.literal("automovil"),
      v.literal("van"),
      v.literal("buseta"),
      v.literal("bus"),
      v.literal("camioneta"),
      v.literal("otro"),
    ),
    prioridad: v.optional(
      v.union(v.literal("normal"), v.literal("alta"), v.literal("critica")),
    ),
    tarifaAcordada: v.optional(v.number()),
    observaciones: v.optional(v.string()),
  },
  returns: v.id("serviciosTransporte"),
  handler: async (ctx, args) => {
    return await programarServicioHelper(ctx, ACTOR_SISTEMA, args);
  },
});

// ---------------------------------------------------------------------------
// Mutations — asignación y ciclo de vida del servicio (capa de datos)
// ---------------------------------------------------------------------------

export const asignarVehiculoYConductor = mutation({
  args: {
    servicioId: v.id("serviciosTransporte"),
    vehiculoId: v.id("vehiculos"),
    conductorId: v.id("conductores"),
    gestorId: v.optional(v.id("gestoresValidados")),
    asignadoPor: v.string(),
    confirmarInmediato: v.optional(v.boolean()),
  },
  returns: v.id("asignacionesServicio"),
  handler: async (ctx, args) => {
    return await asignarHelper(ctx, ACTOR_SISTEMA, args);
  },
});

export const reemplazarAsignacion = mutation({
  args: {
    servicioId: v.id("serviciosTransporte"),
    vehiculoId: v.id("vehiculos"),
    conductorId: v.id("conductores"),
    gestorId: v.optional(v.id("gestoresValidados")),
    asignadoPor: v.string(),
    motivoReemplazo: v.string(),
    confirmarInmediato: v.optional(v.boolean()),
  },
  returns: v.id("asignacionesServicio"),
  handler: async (ctx, args) => {
    return await reemplazarAsignacionHelper(ctx, ACTOR_SISTEMA, args);
  },
});

export const registrarChecklistPreoperativo = internalMutation({
  args: {
    servicioId: v.id("serviciosTransporte"),
    vehiculoId: v.id("vehiculos"),
    conductorId: v.id("conductores"),
    combustibleOk: v.boolean(),
    llantasOk: v.boolean(),
    lucesOk: v.boolean(),
    documentosOk: v.boolean(),
    limpiezaOk: v.boolean(),
    gpsOk: v.boolean(),
    observaciones: v.optional(v.string()),
  },
  returns: v.id("checklistsPreoperativos"),
  handler: async (ctx, args) => {
    return await registrarChecklistHelper(ctx, ACTOR_SISTEMA, args);
  },
});

export const iniciarServicio = mutation({
  args: {
    servicioId: v.id("serviciosTransporte"),
    geo: v.optional(v.object({ lat: v.number(), lng: v.number() })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await iniciarServicioHelper(ctx, ACTOR_SISTEMA, args);
    return null;
  },
});

export const registrarSeguimientoGps = internalMutation({
  args: {
    servicioId: v.id("serviciosTransporte"),
    lat: v.number(),
    lng: v.number(),
    velocidad: v.optional(v.number()),
    fuente: v.union(
      v.literal("gpsVehiculo"),
      v.literal("appConductor"),
      v.literal("telegram"),
      v.literal("manual"),
    ),
    evento: v.union(
      v.literal("ubicacion"),
      v.literal("inicio"),
      v.literal("parada"),
      v.literal("desvio"),
      v.literal("finalizacion"),
      v.literal("alerta"),
    ),
  },
  returns: v.id("seguimientosGps"),
  handler: async (ctx, args) => {
    return await registrarGpsHelper(ctx, ACTOR_SISTEMA, args);
  },
});

export const registrarEvidenciaServicio = internalMutation({
  args: {
    servicioId: v.id("serviciosTransporte"),
    tipo: v.union(
      v.literal("foto"),
      v.literal("firma"),
      v.literal("documento"),
      v.literal("comentario"),
      v.literal("gps"),
      v.literal("llamada"),
      v.literal("telegram"),
      v.literal("otro"),
    ),
    descripcion: v.string(),
    archivoUrl: v.optional(v.string()),
    creadoPorTipo: v.union(
      v.literal("conductor"),
      v.literal("coordinador"),
      v.literal("cliente"),
      v.literal("sistema"),
      v.literal("telegram"),
    ),
    creadoPorId: v.optional(v.string()),
  },
  returns: v.id("evidenciasServicio"),
  handler: async (ctx, args) => {
    return await registrarEvidenciaHelper(ctx, ACTOR_SISTEMA, args);
  },
});

export const registrarIncidencia = mutation({
  args: {
    servicioId: v.id("serviciosTransporte"),
    tipo: v.union(
      v.literal("retraso"),
      v.literal("noShow"),
      v.literal("fallaVehiculo"),
      v.literal("cambioRuta"),
      v.literal("accidente"),
      v.literal("queja"),
      v.literal("contingencia"),
      v.literal("otro"),
    ),
    severidad: v.union(
      v.literal("baja"),
      v.literal("media"),
      v.literal("alta"),
      v.literal("critica"),
    ),
    descripcion: v.string(),
    responsable: v.optional(v.string()),
  },
  returns: v.id("incidencias"),
  handler: async (ctx, args) => {
    return await registrarIncidenciaHelper(ctx, ACTOR_SISTEMA, args);
  },
});

export const resolverIncidencia = mutation({
  args: {
    incidenciaId: v.id("incidencias"),
    accionCorrectiva: v.string(),
    responsable: v.optional(v.string()),
    cerrar: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await resolverIncidenciaHelper(ctx, ACTOR_SISTEMA, args);
    return null;
  },
});

export const cerrarServicio = mutation({
  args: {
    servicioId: v.id("serviciosTransporte"),
    notaCierre: v.optional(v.string()),
    cantidadPasajerosReal: v.optional(v.number()),
    geo: v.optional(v.object({ lat: v.number(), lng: v.number() })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await cerrarServicioHelper(ctx, ACTOR_SISTEMA, args);
    return null;
  },
});

// ---------------------------------------------------------------------------
// Mutations — financiero, cumplimiento y desempeño
// ---------------------------------------------------------------------------

export const crearLiquidacion = internalMutation({
  args: {
    servicioId: v.id("serviciosTransporte"),
    propietarioId: v.optional(v.id("propietarios")),
    conductorId: v.optional(v.id("conductores")),
    gestorId: v.optional(v.id("gestoresValidados")),
    valorBruto: v.number(),
    descuentos: v.optional(v.number()),
    bonos: v.optional(v.number()),
    observaciones: v.optional(v.string()),
  },
  returns: v.id("liquidaciones"),
  handler: async (ctx, args) => {
    const servicio = await obtenerServicio(ctx, args.servicioId);
    if (servicio.estado !== "completado") {
      throw new Error(
        `Solo se liquidan servicios completados (actual: ${servicio.estado})`,
      );
    }
    const valorNeto = args.valorBruto - (args.descuentos ?? 0) + (args.bonos ?? 0);
    if (valorNeto < 0) throw new Error("La liquidación no puede tener valor neto negativo");
    const liquidacionId = await ctx.db.insert("liquidaciones", {
      ...args,
      valorNeto,
      estado: "pendiente",
    });
    await registrarAuditoria(ctx, ACTOR_SISTEMA, {
      accion: "liquidacion.creada",
      entidadTipo: "liquidaciones",
      entidadId: liquidacionId,
      resultado: "ok",
      detalle: `neto ${valorNeto}`,
    });
    return liquidacionId;
  },
});

async function aprobarLiquidacionHelper(
  ctx: MutationCtx,
  actor: ActorAuditoria,
  liquidacionId: Id<"liquidaciones">,
): Promise<void> {
  const liquidacion = await ctx.db.get(liquidacionId);
  if (liquidacion === null) throw new Error("Liquidación no encontrada");
  if (liquidacion.estado !== "pendiente") {
    throw new Error(`Solo se aprueban liquidaciones pendientes (actual: ${liquidacion.estado})`);
  }
  await ctx.db.patch(liquidacionId, {
    estado: "aprobada",
    fechaLiquidacion: Date.now(),
  });
  await registrarAuditoria(ctx, actor, {
    accion: "liquidacion.aprobada",
    entidadTipo: "liquidaciones",
    entidadId: liquidacionId,
    resultado: "ok",
  });
}

export const aprobarLiquidacion = internalMutation({
  args: { liquidacionId: v.id("liquidaciones") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await aprobarLiquidacionHelper(ctx, ACTOR_SISTEMA, args.liquidacionId);
    return null;
  },
});

export const marcarLiquidacionPagada = internalMutation({
  args: { liquidacionId: v.id("liquidaciones") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const liquidacion = await ctx.db.get(args.liquidacionId);
    if (liquidacion === null) throw new Error("Liquidación no encontrada");
    if (liquidacion.estado !== "aprobada") {
      throw new Error(`Solo se pagan liquidaciones aprobadas (actual: ${liquidacion.estado})`);
    }
    await ctx.db.patch(args.liquidacionId, { estado: "pagada" });
    await registrarAuditoria(ctx, ACTOR_SISTEMA, {
      accion: "liquidacion.pagada",
      entidadTipo: "liquidaciones",
      entidadId: args.liquidacionId,
      resultado: "ok",
    });
    return null;
  },
});

const DIAS_POR_VENCER = 30;

function estadoSegunVencimiento(fechaVencimiento?: string): "vigente" | "porVencer" | "vencido" {
  if (fechaVencimiento === undefined) return "vigente";
  const hoy = hoyISO();
  if (fechaVencimiento < hoy) return "vencido";
  return fechaVencimiento <= sumarDiasISO(hoy, DIAS_POR_VENCER) ? "porVencer" : "vigente";
}

export const registrarDocumentoCumplimiento = mutation({
  args: {
    entidadTipo: v.union(
      v.literal("conductor"),
      v.literal("vehiculo"),
      v.literal("propietario"),
      v.literal("gestor"),
    ),
    conductorId: v.optional(v.id("conductores")),
    vehiculoId: v.optional(v.id("vehiculos")),
    propietarioId: v.optional(v.id("propietarios")),
    gestorId: v.optional(v.id("gestoresValidados")),
    tipoDocumento: v.union(
      v.literal("licencia"),
      v.literal("soat"),
      v.literal("tecnomecanica"),
      v.literal("poliza"),
      v.literal("capacitacion"),
      v.literal("contrato"),
      v.literal("otro"),
    ),
    numero: v.optional(v.string()),
    fechaEmision: v.optional(v.string()),
    fechaVencimiento: v.optional(v.string()),
    archivoUrl: v.optional(v.string()),
  },
  returns: v.id("documentosCumplimiento"),
  handler: async (ctx, args) => {
    const referencias = {
      conductor: args.conductorId,
      vehiculo: args.vehiculoId,
      propietario: args.propietarioId,
      gestor: args.gestorId,
    } as const;
    if (referencias[args.entidadTipo] === undefined) {
      throw new Error(`Falta el id de ${args.entidadTipo} para el documento`);
    }
    const documentoId = await ctx.db.insert("documentosCumplimiento", {
      ...args,
      estado: estadoSegunVencimiento(args.fechaVencimiento),
    });
    await registrarAuditoria(ctx, ACTOR_SISTEMA, {
      accion: "documento.registrado",
      entidadTipo: "documentosCumplimiento",
      entidadId: documentoId,
      resultado: "ok",
      detalle: `${args.tipoDocumento} de ${args.entidadTipo}`,
    });
    return documentoId;
  },
});

async function actualizarEstadoDocumentoHelper(
  ctx: MutationCtx,
  actor: ActorAuditoria,
  args: {
    documentoId: Id<"documentosCumplimiento">;
    estado: Doc<"documentosCumplimiento">["estado"];
    verificadoPor?: string;
  },
): Promise<void> {
  const documento = await ctx.db.get(args.documentoId);
  if (documento === null) throw new Error("Documento no encontrado");
  await ctx.db.patch(args.documentoId, {
    estado: args.estado,
    verificadoPor: args.verificadoPor ?? documento.verificadoPor,
    fechaVerificacion: Date.now(),
  });
  await registrarAuditoria(ctx, actor, {
    accion: `documento.${args.estado}`,
    entidadTipo: "documentosCumplimiento",
    entidadId: args.documentoId,
    resultado: "ok",
    detalle: documento.tipoDocumento,
  });
}

export const actualizarEstadoDocumento = mutation({
  args: {
    documentoId: v.id("documentosCumplimiento"),
    estado: v.union(
      v.literal("vigente"),
      v.literal("porVencer"),
      v.literal("vencido"),
      v.literal("rechazado"),
    ),
    verificadoPor: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await actualizarEstadoDocumentoHelper(ctx, ACTOR_SISTEMA, args);
    return null;
  },
});

/**
 * Refresco periódico de estados de documentos (cron diario, ver crons.ts).
 * El `estado` almacenado es un snapshot: sin esto, un documento "vigente"
 * cuya fecha ya pasó jamás se volvería "vencido" y no bloquearía asignaciones.
 */
export const refrescarEstadosDocumentos = internalMutation({
  args: {},
  returns: v.object({ vencidos: v.number(), porVencer: v.number() }),
  handler: async (ctx) => {
    const hoy = hoyISO();
    const limite = sumarDiasISO(hoy, DIAS_POR_VENCER);
    let vencidos = 0;
    let porVencer = 0;
    for (const estado of ["vigente", "porVencer"] as const) {
      const expirados = await ctx.db
        .query("documentosCumplimiento")
        .withIndex("by_estado_vencimiento", (q) =>
          q.eq("estado", estado).lt("fechaVencimiento", hoy),
        )
        .collect();
      for (const documento of expirados) {
        // El rango lt() también captura fechaVencimiento undefined (ordena
        // antes que cualquier string); esos documentos no vencen.
        if (documento.fechaVencimiento === undefined) continue;
        await ctx.db.patch(documento._id, { estado: "vencido" });
        vencidos += 1;
      }
    }
    const proximos = await ctx.db
      .query("documentosCumplimiento")
      .withIndex("by_estado_vencimiento", (q) =>
        q.eq("estado", "vigente").gte("fechaVencimiento", hoy).lte("fechaVencimiento", limite),
      )
      .collect();
    for (const documento of proximos) {
      await ctx.db.patch(documento._id, { estado: "porVencer" });
      porVencer += 1;
    }
    if (vencidos > 0 || porVencer > 0) {
      await registrarAuditoria(ctx, ACTOR_SISTEMA, {
        accion: "documentos.refrescoEstados",
        entidadTipo: "documentosCumplimiento",
        resultado: "ok",
        detalle: `${vencidos} vencido(s), ${porVencer} por vencer`,
      });
    }
    return { vencidos, porVencer };
  },
});

async function registrarMantenimientoHelper(
  ctx: MutationCtx,
  actor: ActorAuditoria,
  args: {
    vehiculoId: Id<"vehiculos">;
    tipo: Doc<"mantenimientos">["tipo"];
    fechaProgramada: string;
    kilometraje?: number;
    proveedor?: string;
    observaciones?: string;
    ponerVehiculoEnMantenimiento?: boolean;
  },
): Promise<Id<"mantenimientos">> {
  const vehiculo = await ctx.db.get(args.vehiculoId);
  if (vehiculo === null) throw new Error("Vehículo no encontrado");
  const mantenimientoId = await ctx.db.insert("mantenimientos", {
    vehiculoId: args.vehiculoId,
    tipo: args.tipo,
    fechaProgramada: args.fechaProgramada,
    kilometraje: args.kilometraje,
    proveedor: args.proveedor,
    resultado: "pendiente",
    observaciones: args.observaciones,
  });
  if (args.ponerVehiculoEnMantenimiento === true && vehiculo.estado === "habilitado") {
    await ctx.db.patch(args.vehiculoId, { estado: "enMantenimiento" });
  }
  await registrarAuditoria(ctx, actor, {
    accion: "mantenimiento.registrado",
    entidadTipo: "mantenimientos",
    entidadId: mantenimientoId,
    resultado: "ok",
    detalle: `${args.tipo} ${vehiculo.placa} ${args.fechaProgramada}`,
  });
  return mantenimientoId;
}

export const registrarMantenimiento = mutation({
  args: {
    vehiculoId: v.id("vehiculos"),
    tipo: v.union(v.literal("preventivo"), v.literal("correctivo"), v.literal("inspeccion")),
    fechaProgramada: v.string(),
    kilometraje: v.optional(v.number()),
    proveedor: v.optional(v.string()),
    observaciones: v.optional(v.string()),
    ponerVehiculoEnMantenimiento: v.optional(v.boolean()),
  },
  returns: v.id("mantenimientos"),
  handler: async (ctx, args) => {
    return await registrarMantenimientoHelper(ctx, ACTOR_SISTEMA, args);
  },
});

export const evaluarDesempeno = internalMutation({
  args: {
    entidadTipo: v.union(
      v.literal("conductor"),
      v.literal("vehiculo"),
      v.literal("propietario"),
      v.literal("gestor"),
      v.literal("operacion"),
    ),
    conductorId: v.optional(v.id("conductores")),
    vehiculoId: v.optional(v.id("vehiculos")),
    propietarioId: v.optional(v.id("propietarios")),
    gestorId: v.optional(v.id("gestoresValidados")),
    operacionId: v.optional(v.id("operaciones")),
    periodoInicio: v.string(),
    periodoFin: v.string(),
    puntualidadScore: v.optional(v.number()),
    seguridadScore: v.optional(v.number()),
    cumplimientoScore: v.optional(v.number()),
    quejasCount: v.optional(v.number()),
    incidenciasCount: v.optional(v.number()),
    resultado: v.union(
      v.literal("excelente"),
      v.literal("bueno"),
      v.literal("aceptable"),
      v.literal("deficiente"),
      v.literal("critico"),
    ),
  },
  returns: v.id("evaluacionesDesempeno"),
  handler: async (ctx, args) => {
    const evaluacionId = await ctx.db.insert("evaluacionesDesempeno", args);
    await registrarAuditoria(ctx, ACTOR_SISTEMA, {
      accion: "evaluacion.registrada",
      entidadTipo: "evaluacionesDesempeno",
      entidadId: evaluacionId,
      resultado: "ok",
      detalle: `${args.entidadTipo}: ${args.resultado}`,
    });
    return evaluacionId;
  },
});

// ---------------------------------------------------------------------------
// Mutations — flota de gestor validado (links históricos)
// ---------------------------------------------------------------------------

export const vincularVehiculoAGestor = mutation({
  args: {
    gestorId: v.id("gestoresValidados"),
    vehiculoId: v.id("vehiculos"),
  },
  returns: v.id("vehiculosGestor"),
  handler: async (ctx, args) => {
    const gestor = await ctx.db.get(args.gestorId);
    const vehiculo = await ctx.db.get(args.vehiculoId);
    if (gestor === null) throw new Error("Gestor no encontrado");
    if (gestor.estado !== "validado") throw new Error(`El gestor está ${gestor.estado}`);
    if (vehiculo === null) throw new Error("Vehículo no encontrado");
    const activos = await ctx.db
      .query("vehiculosGestor")
      .withIndex("by_gestor_estado", (q) =>
        q.eq("gestorId", args.gestorId).eq("estado", "activo"),
      )
      .collect();
    if (activos.some((vinculo) => vinculo.vehiculoId === args.vehiculoId)) {
      throw new Error(`El vehículo ${vehiculo.placa} ya está en la flota del gestor`);
    }
    const vinculoId = await ctx.db.insert("vehiculosGestor", {
      gestorId: args.gestorId,
      vehiculoId: args.vehiculoId,
      fechaDesde: hoyISO(),
      estado: "activo",
    });
    await registrarAuditoria(ctx, ACTOR_SISTEMA, {
      accion: "gestor.vehiculoVinculado",
      entidadTipo: "gestoresValidados",
      entidadId: args.gestorId,
      resultado: "ok",
      detalle: vehiculo.placa,
    });
    return vinculoId;
  },
});

export const desvincularVehiculoDeGestor = mutation({
  args: {
    gestorId: v.id("gestoresValidados"),
    vehiculoId: v.id("vehiculos"),
    motivo: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const activos = await ctx.db
      .query("vehiculosGestor")
      .withIndex("by_gestor_estado", (q) =>
        q.eq("gestorId", args.gestorId).eq("estado", "activo"),
      )
      .collect();
    const vinculo = activos.find((va) => va.vehiculoId === args.vehiculoId);
    if (vinculo === undefined) throw new Error("El vehículo no está activo en esa flota");
    await ctx.db.patch(vinculo._id, { estado: "retirado", fechaHasta: hoyISO() });
    await registrarAuditoria(ctx, ACTOR_SISTEMA, {
      accion: "gestor.vehiculoDesvinculado",
      entidadTipo: "gestoresValidados",
      entidadId: args.gestorId,
      resultado: "ok",
      detalle: args.motivo,
    });
    return null;
  },
});

export const vincularConductorAGestor = mutation({
  args: {
    gestorId: v.id("gestoresValidados"),
    conductorId: v.id("conductores"),
  },
  returns: v.id("conductoresGestor"),
  handler: async (ctx, args) => {
    const gestor = await ctx.db.get(args.gestorId);
    const conductor = await ctx.db.get(args.conductorId);
    if (gestor === null) throw new Error("Gestor no encontrado");
    if (gestor.estado !== "validado") throw new Error(`El gestor está ${gestor.estado}`);
    if (conductor === null) throw new Error("Conductor no encontrado");
    const activos = await ctx.db
      .query("conductoresGestor")
      .withIndex("by_gestor_estado", (q) =>
        q.eq("gestorId", args.gestorId).eq("estado", "activo"),
      )
      .collect();
    if (activos.some((vinculo) => vinculo.conductorId === args.conductorId)) {
      throw new Error(`El conductor ${conductor.nombre} ya está vinculado al gestor`);
    }
    const vinculoId = await ctx.db.insert("conductoresGestor", {
      gestorId: args.gestorId,
      conductorId: args.conductorId,
      fechaDesde: hoyISO(),
      estado: "activo",
    });
    await registrarAuditoria(ctx, ACTOR_SISTEMA, {
      accion: "gestor.conductorVinculado",
      entidadTipo: "gestoresValidados",
      entidadId: args.gestorId,
      resultado: "ok",
      detalle: conductor.nombre,
    });
    return vinculoId;
  },
});

export const desvincularConductorDeGestor = mutation({
  args: {
    gestorId: v.id("gestoresValidados"),
    conductorId: v.id("conductores"),
    motivo: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const activos = await ctx.db
      .query("conductoresGestor")
      .withIndex("by_gestor_estado", (q) =>
        q.eq("gestorId", args.gestorId).eq("estado", "activo"),
      )
      .collect();
    const vinculo = activos.find((va) => va.conductorId === args.conductorId);
    if (vinculo === undefined) throw new Error("El conductor no está activo con ese gestor");
    await ctx.db.patch(vinculo._id, { estado: "retirado", fechaHasta: hoyISO() });
    await registrarAuditoria(ctx, ACTOR_SISTEMA, {
      accion: "gestor.conductorDesvinculado",
      entidadTipo: "gestoresValidados",
      entidadId: args.gestorId,
      resultado: "ok",
      detalle: args.motivo,
    });
    return null;
  },
});

// ---------------------------------------------------------------------------
// Mutations — identidad y soporte de apps
// ---------------------------------------------------------------------------

export const crearUsuarioSistema = internalMutation({
  args: {
    nombre: v.string(),
    email: v.optional(v.string()),
    telefono: v.optional(v.string()),
    tipoUsuario: v.union(
      v.literal("operadorLogistico"),
      v.literal("coordinador"),
      v.literal("conductor"),
      v.literal("propietario"),
      v.literal("gestor"),
      v.literal("cliente"),
      v.literal("admin"),
      v.literal("sistema"),
    ),
    conductorId: v.optional(v.id("conductores")),
    propietarioId: v.optional(v.id("propietarios")),
    gestorId: v.optional(v.id("gestoresValidados")),
    clienteId: v.optional(v.id("clientes")),
  },
  returns: v.id("usuariosSistema"),
  handler: async (ctx, args) => {
    const usuarioId = await ctx.db.insert("usuariosSistema", {
      ...args,
      estado: "activo",
      creadoEn: Date.now(),
    });
    await registrarAuditoria(ctx, ACTOR_SISTEMA, {
      accion: "usuario.creado",
      entidadTipo: "usuariosSistema",
      entidadId: usuarioId,
      resultado: "ok",
      detalle: `${args.nombre} (${args.tipoUsuario})`,
    });
    return usuarioId;
  },
});

export const asignarRolUsuario = internalMutation({
  args: {
    usuarioSistemaId: v.id("usuariosSistema"),
    rolSistemaId: v.id("rolesSistema"),
  },
  returns: v.id("usuariosRoles"),
  handler: async (ctx, args) => {
    const usuario = await ctx.db.get(args.usuarioSistemaId);
    const rol = await ctx.db.get(args.rolSistemaId);
    if (usuario === null) throw new Error("Usuario no encontrado");
    if (rol === null) throw new Error("Rol no encontrado");
    const activos = await ctx.db
      .query("usuariosRoles")
      .withIndex("by_usuario_estado", (q) =>
        q.eq("usuarioSistemaId", args.usuarioSistemaId).eq("estado", "activo"),
      )
      .collect();
    if (activos.some((vinculo) => vinculo.rolSistemaId === args.rolSistemaId)) {
      throw new Error(`El usuario ya tiene el rol ${rol.nombre} activo`);
    }
    const vinculoId = await ctx.db.insert("usuariosRoles", {
      usuarioSistemaId: args.usuarioSistemaId,
      rolSistemaId: args.rolSistemaId,
      fechaDesde: hoyISO(),
      estado: "activo",
    });
    await registrarAuditoria(ctx, ACTOR_SISTEMA, {
      accion: "rol.asignado",
      entidadTipo: "usuariosSistema",
      entidadId: args.usuarioSistemaId,
      resultado: "ok",
      detalle: rol.nombre,
    });
    return vinculoId;
  },
});

export const revocarRolUsuario = internalMutation({
  args: {
    usuarioSistemaId: v.id("usuariosSistema"),
    rolSistemaId: v.id("rolesSistema"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const activos = await ctx.db
      .query("usuariosRoles")
      .withIndex("by_usuario_estado", (q) =>
        q.eq("usuarioSistemaId", args.usuarioSistemaId).eq("estado", "activo"),
      )
      .collect();
    const vinculo = activos.find((va) => va.rolSistemaId === args.rolSistemaId);
    if (vinculo === undefined) throw new Error("El usuario no tiene ese rol activo");
    await ctx.db.patch(vinculo._id, { estado: "revocado", fechaHasta: hoyISO() });
    await registrarAuditoria(ctx, ACTOR_SISTEMA, {
      accion: "rol.revocado",
      entidadTipo: "usuariosSistema",
      entidadId: args.usuarioSistemaId,
      resultado: "ok",
    });
    return null;
  },
});

export const registrarAuditoriaAccion = internalMutation({
  args: {
    actorTipo: v.union(
      v.literal("usuario"),
      v.literal("conductor"),
      v.literal("sistema"),
      v.literal("telegram"),
      v.literal("dashboard"),
    ),
    actorId: v.optional(v.string()),
    accion: v.string(),
    entidadTipo: v.string(),
    entidadId: v.optional(v.string()),
    origen: v.union(
      v.literal("convex"),
      v.literal("rustInterface"),
      v.literal("webDashboard"),
      v.literal("telegramBot"),
      v.literal("sistema"),
    ),
    resultado: v.union(v.literal("ok"), v.literal("error"), v.literal("rechazado")),
    detalle: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await registrarAuditoria(
      ctx,
      { actorTipo: args.actorTipo, actorId: args.actorId, origen: args.origen },
      {
        accion: args.accion,
        entidadTipo: args.entidadTipo,
        entidadId: args.entidadId,
        resultado: args.resultado,
        detalle: args.detalle,
      },
    );
    return null;
  },
});

export const vincularCuentaTelegram = mutation({
  args: {
    telegramUserId: v.string(),
    telegramChatId: v.string(),
    username: v.optional(v.string()),
    telefono: v.optional(v.string()),
    conductorId: v.optional(v.id("conductores")),
    usuarioSistemaId: v.optional(v.id("usuariosSistema")),
  },
  returns: v.id("telegramCuentas"),
  handler: async (ctx, args) => {
    if (args.conductorId !== undefined) {
      const conductor = await ctx.db.get(args.conductorId);
      if (conductor === null) throw new Error("Conductor no encontrado");
    }
    const estado =
      args.conductorId !== undefined || args.usuarioSistemaId !== undefined
        ? "vinculada"
        : "pendienteVerificacion";
    const existente = await ctx.db
      .query("telegramCuentas")
      .withIndex("by_telegramUserId", (q) => q.eq("telegramUserId", args.telegramUserId))
      .unique();
    // Una cuenta ya vinculada no se re-apunta a otro conductor/usuario por esta
    // vía: hay que desvincularla primero (evita tomas de cuenta silenciosas).
    if (existente !== null && existente.estado === "vinculada") {
      const cambiaConductor =
        args.conductorId !== undefined &&
        existente.conductorId !== undefined &&
        args.conductorId !== existente.conductorId;
      const cambiaUsuario =
        args.usuarioSistemaId !== undefined &&
        existente.usuarioSistemaId !== undefined &&
        args.usuarioSistemaId !== existente.usuarioSistemaId;
      if (cambiaConductor || cambiaUsuario) {
        throw new Error(
          "La cuenta de Telegram ya está vinculada a otra identidad; desvincúlela primero",
        );
      }
    }
    let cuentaId: Id<"telegramCuentas">;
    if (existente !== null) {
      await ctx.db.patch(existente._id, {
        telegramChatId: args.telegramChatId,
        username: args.username ?? existente.username,
        telefono: args.telefono ?? existente.telefono,
        conductorId: args.conductorId ?? existente.conductorId,
        usuarioSistemaId: args.usuarioSistemaId ?? existente.usuarioSistemaId,
        estado,
        fechaVinculacion: Date.now(),
      });
      cuentaId = existente._id;
    } else {
      cuentaId = await ctx.db.insert("telegramCuentas", {
        ...args,
        estado,
        fechaVinculacion: Date.now(),
      });
    }
    await registrarAuditoria(
      ctx,
      { actorTipo: "telegram", actorId: cuentaId, origen: "telegramBot" },
      {
        accion: "telegram.vinculada",
        entidadTipo: "telegramCuentas",
        entidadId: cuentaId,
        resultado: "ok",
        detalle: args.username,
      },
    );
    return cuentaId;
  },
});

export const desvincularCuentaTelegram = mutation({
  args: { telegramUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cuenta = await ctx.db
      .query("telegramCuentas")
      .withIndex("by_telegramUserId", (q) => q.eq("telegramUserId", args.telegramUserId))
      .unique();
    if (cuenta === null) throw new Error("Cuenta de Telegram no encontrada");
    await ctx.db.patch(cuenta._id, { estado: "desvinculada" });
    await registrarAuditoria(
      ctx,
      { actorTipo: "telegram", actorId: cuenta._id, origen: "telegramBot" },
      {
        accion: "telegram.desvinculada",
        entidadTipo: "telegramCuentas",
        entidadId: cuenta._id,
        resultado: "ok",
      },
    );
    return null;
  },
});

export const actualizarUltimoComandoTelegram = mutation({
  args: { telegramUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cuenta = await ctx.db
      .query("telegramCuentas")
      .withIndex("by_telegramUserId", (q) => q.eq("telegramUserId", args.telegramUserId))
      .unique();
    if (cuenta === null) throw new Error("Cuenta de Telegram no encontrada");
    await ctx.db.patch(cuenta._id, { ultimoComandoEn: Date.now() });
    return null;
  },
});

// ---------------------------------------------------------------------------
// Mutations seguras para conductor / Telegram
// El conductor solo puede actuar sobre servicios con asignación suya.
// ---------------------------------------------------------------------------

export const conductorConfirmarAsignacion = mutation({
  args: {
    telegramUserId: v.optional(v.string()),
    conductorId: v.optional(v.id("conductores")),
    asignacionId: v.id("asignacionesServicio"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { conductor, actor } = await resolverConductorActor(ctx, args);
    const asignacion = await ctx.db.get(args.asignacionId);
    if (asignacion === null) throw new Error("Asignación no encontrada");
    if (asignacion.conductorId !== conductor._id) {
      await registrarAuditoria(ctx, actor, {
        accion: "asignacion.confirmada",
        entidadTipo: "asignacionesServicio",
        entidadId: args.asignacionId,
        resultado: "rechazado",
        detalle: "La asignación no pertenece a este conductor",
      });
      throw new Error("La asignación no pertenece a este conductor");
    }
    await confirmarAsignacionHelper(ctx, actor, asignacion);
    return null;
  },
});

export const conductorRechazarAsignacion = mutation({
  args: {
    telegramUserId: v.optional(v.string()),
    conductorId: v.optional(v.id("conductores")),
    asignacionId: v.id("asignacionesServicio"),
    motivo: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.motivo.trim() === "") throw new Error("El rechazo exige un motivo");
    const { conductor, actor } = await resolverConductorActor(ctx, args);
    const asignacion = await ctx.db.get(args.asignacionId);
    if (asignacion === null) throw new Error("Asignación no encontrada");
    if (asignacion.conductorId !== conductor._id) {
      throw new Error("La asignación no pertenece a este conductor");
    }
    if (asignacion.estado !== "propuesta") {
      throw new Error(`Solo se rechazan asignaciones propuestas (actual: ${asignacion.estado})`);
    }
    await ctx.db.patch(args.asignacionId, {
      estado: "rechazada",
      motivoReemplazo: args.motivo,
    });
    await registrarAuditoria(ctx, actor, {
      accion: "asignacion.rechazada",
      entidadTipo: "asignacionesServicio",
      entidadId: args.asignacionId,
      resultado: "ok",
      detalle: args.motivo,
    });
    return null;
  },
});

export const conductorEnviarChecklist = mutation({
  args: {
    telegramUserId: v.optional(v.string()),
    conductorId: v.optional(v.id("conductores")),
    servicioId: v.id("serviciosTransporte"),
    combustibleOk: v.boolean(),
    llantasOk: v.boolean(),
    lucesOk: v.boolean(),
    documentosOk: v.boolean(),
    limpiezaOk: v.boolean(),
    gpsOk: v.boolean(),
    observaciones: v.optional(v.string()),
  },
  returns: v.id("checklistsPreoperativos"),
  handler: async (ctx, args) => {
    const { conductor, actor } = await resolverConductorActor(ctx, args);
    const asignacion = await requerirAsignacionDeConductor(
      ctx,
      conductor._id,
      args.servicioId,
    );
    return await registrarChecklistHelper(ctx, actor, {
      servicioId: args.servicioId,
      vehiculoId: asignacion.vehiculoId,
      conductorId: conductor._id,
      combustibleOk: args.combustibleOk,
      llantasOk: args.llantasOk,
      lucesOk: args.lucesOk,
      documentosOk: args.documentosOk,
      limpiezaOk: args.limpiezaOk,
      gpsOk: args.gpsOk,
      observaciones: args.observaciones,
    });
  },
});

export const conductorIniciarServicio = mutation({
  args: {
    telegramUserId: v.optional(v.string()),
    conductorId: v.optional(v.id("conductores")),
    servicioId: v.id("serviciosTransporte"),
    geo: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    fuente: v.optional(v.union(v.literal("telegram"), v.literal("appConductor"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { conductor, actor } = await resolverConductorActor(ctx, args);
    await requerirAsignacionDeConductor(ctx, conductor._id, args.servicioId);
    await iniciarServicioHelper(ctx, actor, {
      servicioId: args.servicioId,
      geo: args.geo,
      fuente: args.fuente ?? "telegram",
    });
    return null;
  },
});

export const conductorReportarUbicacion = mutation({
  args: {
    telegramUserId: v.optional(v.string()),
    conductorId: v.optional(v.id("conductores")),
    servicioId: v.id("serviciosTransporte"),
    lat: v.number(),
    lng: v.number(),
    velocidad: v.optional(v.number()),
    fuente: v.union(v.literal("telegram"), v.literal("appConductor")),
    evento: v.optional(
      v.union(
        v.literal("ubicacion"),
        v.literal("parada"),
        v.literal("desvio"),
        v.literal("alerta"),
      ),
    ),
  },
  returns: v.id("seguimientosGps"),
  handler: async (ctx, args) => {
    const { conductor, actor } = await resolverConductorActor(ctx, args);
    await requerirAsignacionDeConductor(ctx, conductor._id, args.servicioId);
    return await registrarGpsHelper(ctx, actor, {
      servicioId: args.servicioId,
      lat: args.lat,
      lng: args.lng,
      velocidad: args.velocidad,
      fuente: args.fuente,
      evento: args.evento ?? "ubicacion",
    });
  },
});

export const conductorRegistrarEvidencia = mutation({
  args: {
    telegramUserId: v.optional(v.string()),
    conductorId: v.optional(v.id("conductores")),
    servicioId: v.id("serviciosTransporte"),
    tipo: v.union(
      v.literal("foto"),
      v.literal("firma"),
      v.literal("documento"),
      v.literal("comentario"),
      v.literal("telegram"),
      v.literal("otro"),
    ),
    descripcion: v.string(),
    archivoUrl: v.optional(v.string()),
  },
  returns: v.id("evidenciasServicio"),
  handler: async (ctx, args) => {
    const { conductor, actor } = await resolverConductorActor(ctx, args);
    await requerirAsignacionDeConductor(ctx, conductor._id, args.servicioId);
    return await registrarEvidenciaHelper(ctx, actor, {
      servicioId: args.servicioId,
      tipo: args.tipo,
      descripcion: args.descripcion,
      archivoUrl: args.archivoUrl,
      creadoPorTipo: args.telegramUserId !== undefined ? "telegram" : "conductor",
      creadoPorId: conductor._id,
    });
  },
});

export const conductorReportarIncidencia = mutation({
  args: {
    telegramUserId: v.optional(v.string()),
    conductorId: v.optional(v.id("conductores")),
    servicioId: v.id("serviciosTransporte"),
    tipo: v.union(
      v.literal("retraso"),
      v.literal("noShow"),
      v.literal("fallaVehiculo"),
      v.literal("cambioRuta"),
      v.literal("accidente"),
      v.literal("queja"),
      v.literal("contingencia"),
      v.literal("otro"),
    ),
    severidad: v.union(
      v.literal("baja"),
      v.literal("media"),
      v.literal("alta"),
      v.literal("critica"),
    ),
    descripcion: v.string(),
  },
  returns: v.id("incidencias"),
  handler: async (ctx, args) => {
    const { conductor, actor } = await resolverConductorActor(ctx, args);
    await requerirAsignacionDeConductor(ctx, conductor._id, args.servicioId);
    return await registrarIncidenciaHelper(ctx, actor, {
      servicioId: args.servicioId,
      tipo: args.tipo,
      severidad: args.severidad,
      descripcion: args.descripcion,
      responsable: conductor.nombre,
    });
  },
});

export const conductorCerrarServicio = mutation({
  args: {
    telegramUserId: v.optional(v.string()),
    conductorId: v.optional(v.id("conductores")),
    servicioId: v.id("serviciosTransporte"),
    notaCierre: v.optional(v.string()),
    cantidadPasajerosReal: v.optional(v.number()),
    geo: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    fuente: v.optional(v.union(v.literal("telegram"), v.literal("appConductor"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { conductor, actor } = await resolverConductorActor(ctx, args);
    await requerirAsignacionDeConductor(ctx, conductor._id, args.servicioId);
    await cerrarServicioHelper(ctx, actor, {
      servicioId: args.servicioId,
      notaCierre: args.notaCierre,
      cantidadPasajerosReal: args.cantidadPasajerosReal,
      geo: args.geo,
      fuente: args.fuente ?? "telegram",
      creadoPorTipo: args.telegramUserId !== undefined ? "telegram" : "conductor",
      creadoPorId: conductor._id,
    });
    return null;
  },
});

// ---------------------------------------------------------------------------
// Mutations seguras para el dashboard
// Exigen actorUsuarioSistemaId y el permiso correspondiente.
// ---------------------------------------------------------------------------

export const dashboardCrearServicio = mutation({
  args: {
    actorUsuarioSistemaId: v.id("usuariosSistema"),
    operacionId: v.id("operaciones"),
    solicitudId: v.optional(v.id("solicitudesServicio")),
    rutaId: v.optional(v.id("rutas")),
    fechaProgramada: v.string(),
    horaInicioProgramada: v.string(),
    horaFinProgramada: v.optional(v.string()),
    origenTexto: v.string(),
    destinoTexto: v.string(),
    origenGeo: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    destinoGeo: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    cantidadPasajerosProgramada: v.optional(v.number()),
    tipoVehiculoRequerido: v.union(
      v.literal("automovil"),
      v.literal("van"),
      v.literal("buseta"),
      v.literal("bus"),
      v.literal("camioneta"),
      v.literal("otro"),
    ),
    prioridad: v.optional(
      v.union(v.literal("normal"), v.literal("alta"), v.literal("critica")),
    ),
    tarifaAcordada: v.optional(v.number()),
    observaciones: v.optional(v.string()),
  },
  returns: v.id("serviciosTransporte"),
  handler: async (ctx, args) => {
    const { actorUsuarioSistemaId, ...datos } = args;
    await requerirPermiso(ctx, actorUsuarioSistemaId, PERMISOS.despachar);
    return await programarServicioHelper(ctx, actorUsuario(actorUsuarioSistemaId), datos);
  },
});

export const dashboardAsignarServicio = mutation({
  args: {
    actorUsuarioSistemaId: v.id("usuariosSistema"),
    servicioId: v.id("serviciosTransporte"),
    vehiculoId: v.id("vehiculos"),
    conductorId: v.id("conductores"),
    gestorId: v.optional(v.id("gestoresValidados")),
    confirmarInmediato: v.optional(v.boolean()),
  },
  returns: v.id("asignacionesServicio"),
  handler: async (ctx, args) => {
    const { actorUsuarioSistemaId, ...datos } = args;
    await requerirPermiso(ctx, actorUsuarioSistemaId, PERMISOS.despachar);
    return await asignarHelper(ctx, actorUsuario(actorUsuarioSistemaId), {
      ...datos,
      asignadoPor: actorUsuarioSistemaId,
    });
  },
});

export const dashboardReemplazarAsignacion = mutation({
  args: {
    actorUsuarioSistemaId: v.id("usuariosSistema"),
    servicioId: v.id("serviciosTransporte"),
    vehiculoId: v.id("vehiculos"),
    conductorId: v.id("conductores"),
    gestorId: v.optional(v.id("gestoresValidados")),
    motivoReemplazo: v.string(),
    confirmarInmediato: v.optional(v.boolean()),
  },
  returns: v.id("asignacionesServicio"),
  handler: async (ctx, args) => {
    const { actorUsuarioSistemaId, ...datos } = args;
    await requerirPermiso(ctx, actorUsuarioSistemaId, PERMISOS.despachar);
    return await reemplazarAsignacionHelper(ctx, actorUsuario(actorUsuarioSistemaId), {
      ...datos,
      asignadoPor: actorUsuarioSistemaId,
    });
  },
});

export const dashboardCancelarServicio = mutation({
  args: {
    actorUsuarioSistemaId: v.id("usuariosSistema"),
    servicioId: v.id("serviciosTransporte"),
    motivo: v.string(),
    marcarFallido: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { actorUsuarioSistemaId, ...datos } = args;
    await requerirPermiso(ctx, actorUsuarioSistemaId, PERMISOS.despachar);
    await cancelarServicioHelper(ctx, actorUsuario(actorUsuarioSistemaId), datos);
    return null;
  },
});

export const dashboardResolverIncidencia = mutation({
  args: {
    actorUsuarioSistemaId: v.id("usuariosSistema"),
    incidenciaId: v.id("incidencias"),
    accionCorrectiva: v.string(),
    responsable: v.optional(v.string()),
    cerrar: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { actorUsuarioSistemaId, ...datos } = args;
    await requerirPermiso(ctx, actorUsuarioSistemaId, PERMISOS.gestionarIncidencias);
    await resolverIncidenciaHelper(ctx, actorUsuario(actorUsuarioSistemaId), datos);
    return null;
  },
});

export const dashboardAprobarLiquidacion = mutation({
  args: {
    actorUsuarioSistemaId: v.id("usuariosSistema"),
    liquidacionId: v.id("liquidaciones"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requerirPermiso(ctx, args.actorUsuarioSistemaId, PERMISOS.aprobarLiquidaciones);
    await aprobarLiquidacionHelper(
      ctx,
      actorUsuario(args.actorUsuarioSistemaId),
      args.liquidacionId,
    );
    return null;
  },
});

export const dashboardActualizarDocumento = mutation({
  args: {
    actorUsuarioSistemaId: v.id("usuariosSistema"),
    documentoId: v.id("documentosCumplimiento"),
    estado: v.union(
      v.literal("vigente"),
      v.literal("porVencer"),
      v.literal("vencido"),
      v.literal("rechazado"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const usuario = await requerirPermiso(
      ctx,
      args.actorUsuarioSistemaId,
      PERMISOS.gestionarDocumentos,
    );
    await actualizarEstadoDocumentoHelper(ctx, actorUsuario(args.actorUsuarioSistemaId), {
      documentoId: args.documentoId,
      estado: args.estado,
      verificadoPor: usuario.nombre,
    });
    return null;
  },
});

export const dashboardProgramarMantenimiento = mutation({
  args: {
    actorUsuarioSistemaId: v.id("usuariosSistema"),
    vehiculoId: v.id("vehiculos"),
    tipo: v.union(v.literal("preventivo"), v.literal("correctivo"), v.literal("inspeccion")),
    fechaProgramada: v.string(),
    kilometraje: v.optional(v.number()),
    proveedor: v.optional(v.string()),
    observaciones: v.optional(v.string()),
    ponerVehiculoEnMantenimiento: v.optional(v.boolean()),
  },
  returns: v.id("mantenimientos"),
  handler: async (ctx, args) => {
    const { actorUsuarioSistemaId, ...datos } = args;
    await requerirPermiso(ctx, actorUsuarioSistemaId, PERMISOS.gestionarDocumentos);
    return await registrarMantenimientoHelper(
      ctx,
      actorUsuario(actorUsuarioSistemaId),
      datos,
    );
  },
});
