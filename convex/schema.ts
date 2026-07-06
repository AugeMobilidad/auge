/**
 * Ontología de Auge Movilidad — Objects y Links.
 *
 * Convenciones:
 * - Campos en camelCase, dominio en español.
 * - Fechas-instante (timestamps) en epoch millis: `v.number()`.
 * - Fechas de calendario (sin hora) en ISO "YYYY-MM-DD": `v.string()`.
 * - Horas del día en "HH:mm": `v.string()`.
 * - Relaciones con `v.id("tabla")`; cuando la relación cambia en el tiempo,
 *   se usa una tabla de link con fechaDesde/fechaHasta en vez de sobrescribir.
 * - Los validadores van SIEMPRE inline (sin consts compartidos ni spreads):
 *   `convex-typegen` parsea este archivo estáticamente y solo reconoce
 *   llamadas directas `v.*(...)` en cada columna.
 */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // =========================================================================
  // OBJECTS — comercial / operativo
  // =========================================================================

  clientes: defineTable({
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
    estado: v.union(v.literal("activo"), v.literal("inactivo")),
    notas: v.optional(v.string()),
  })
    .index("by_estado", ["estado"])
    .index("by_tipo_estado", ["tipo", "estado"]),

  programasMovilidad: defineTable({
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
    fechaInicio: v.string(), // YYYY-MM-DD
    fechaFin: v.optional(v.string()),
    estado: v.union(
      v.literal("borrador"),
      v.literal("activo"),
      v.literal("pausado"),
      v.literal("cerrado"),
    ),
    modalidadPago: v.union(
      v.literal("prepago"),
      v.literal("credito"),
      v.literal("mixto"),
    ),
    requiereReportePeriodico: v.boolean(),
    reglasOperativas: v.optional(v.string()),
  })
    .index("by_cliente", ["clienteId"])
    .index("by_estado", ["estado"])
    .index("by_tipoServicio_estado", ["tipoServicio", "estado"]),

  solicitudesServicio: defineTable({
    clienteId: v.id("clientes"),
    programaId: v.optional(v.id("programasMovilidad")),
    tipoServicio: v.union(
      v.literal("puntual"),
      v.literal("recurrente"),
      v.literal("gestorValidado"),
      v.literal("evento"),
      v.literal("comunidad"),
    ),
    fechaSolicitud: v.number(), // epoch ms
    origenTexto: v.optional(v.string()),
    destinoTexto: v.optional(v.string()),
    fechaHoraRequerida: v.optional(v.number()), // epoch ms
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
    estado: v.union(
      v.literal("recibida"),
      v.literal("validada"),
      v.literal("rechazada"),
      v.literal("convertidaEnOperacion"),
    ),
  })
    .index("by_cliente", ["clienteId"])
    .index("by_programa", ["programaId"])
    .index("by_estado", ["estado"]),

  operaciones: defineTable({
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
    fechaInicio: v.string(), // YYYY-MM-DD
    fechaFin: v.optional(v.string()),
    estado: v.union(
      v.literal("planificada"),
      v.literal("enCurso"),
      v.literal("pausada"),
      v.literal("cerrada"),
      v.literal("cancelada"),
    ),
    responsableOperativo: v.optional(v.string()),
    nivelControl: v.union(
      v.literal("basico"),
      v.literal("controlado"),
      v.literal("comandoOperativo"),
    ),
    requiereCentroControl: v.boolean(),
  })
    .index("by_programa", ["programaId"])
    .index("by_estado", ["estado"]),

  serviciosTransporte: defineTable({
    operacionId: v.id("operaciones"),
    solicitudId: v.optional(v.id("solicitudesServicio")),
    rutaId: v.optional(v.id("rutas")),
    fechaProgramada: v.string(), // YYYY-MM-DD
    horaInicioProgramada: v.string(), // HH:mm
    horaFinProgramada: v.optional(v.string()),
    origenTexto: v.string(),
    destinoTexto: v.string(),
    origenGeo: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    destinoGeo: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    cantidadPasajerosProgramada: v.optional(v.number()),
    cantidadPasajerosReal: v.optional(v.number()),
    tipoVehiculoRequerido: v.union(
      v.literal("automovil"),
      v.literal("van"),
      v.literal("buseta"),
      v.literal("bus"),
      v.literal("camioneta"),
      v.literal("otro"),
    ),
    estado: v.union(
      v.literal("programado"),
      v.literal("asignado"),
      v.literal("enPreparacion"),
      v.literal("enCurso"),
      v.literal("completado"),
      v.literal("cancelado"),
      v.literal("fallido"),
    ),
    prioridad: v.union(
      v.literal("normal"),
      v.literal("alta"),
      v.literal("critica"),
    ),
    tarifaAcordada: v.optional(v.number()),
    observaciones: v.optional(v.string()),
    // Hitos reales denormalizados (se estampan al iniciar/cerrar) para que la
    // puntualidad no exija escanear seguimientosGps.
    inicioRealTimestamp: v.optional(v.number()), // epoch ms
    finRealTimestamp: v.optional(v.number()),
  })
    .index("by_estado_fecha", ["estado", "fechaProgramada"])
    // Nota: el prefijo ["operacionId"] de este índice cubre las consultas
    // "por operación" — no hace falta un índice by_operacion aparte.
    .index("by_operacion_estado_fecha", ["operacionId", "estado", "fechaProgramada"])
    .index("by_ruta_fecha", ["rutaId", "fechaProgramada"])
    .index("by_solicitud", ["solicitudId"])
    .index("by_fecha", ["fechaProgramada"]),

  // =========================================================================
  // OBJECTS — estructura de movilidad
  // =========================================================================

  rutas: defineTable({
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
    activa: v.boolean(),
    frecuencia: v.union(
      v.literal("unica"),
      v.literal("diaria"),
      v.literal("semanal"),
      v.literal("personalizada"),
    ),
    capacidadObjetivo: v.optional(v.number()),
    reglasAbordaje: v.optional(v.string()),
  })
    .index("by_programa", ["programaId"])
    .index("by_activa_tipo", ["activa", "tipoRuta"]),

  paradas: defineTable({
    rutaId: v.id("rutas"),
    nombre: v.string(),
    orden: v.number(),
    direccionTexto: v.string(),
    geo: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    ventanaInicio: v.optional(v.string()), // HH:mm
    ventanaFin: v.optional(v.string()),
    activa: v.boolean(),
  }).index("by_ruta_orden", ["rutaId", "orden"]),

  eventos: defineTable({
    clienteId: v.id("clientes"),
    programaId: v.optional(v.id("programasMovilidad")),
    nombre: v.string(),
    sedePrincipal: v.string(),
    fechaInicio: v.string(), // YYYY-MM-DD
    fechaFin: v.string(),
    aforoEstimado: v.optional(v.number()),
    nivelComplejidad: v.union(
      v.literal("bajo"),
      v.literal("medio"),
      v.literal("alto"),
      v.literal("critico"),
    ),
    modeloOperacion: v.union(
      v.literal("operacionCoordinada"),
      v.literal("comandoOperativo"),
    ),
    estado: v.union(
      v.literal("planeacion"),
      v.literal("montaje"),
      v.literal("enCurso"),
      v.literal("cerrado"),
      v.literal("cancelado"),
    ),
  })
    .index("by_cliente", ["clienteId"])
    .index("by_programa", ["programaId"])
    .index("by_estado", ["estado"]),

  comunidades: defineTable({
    clienteId: v.id("clientes"),
    nombre: v.string(),
    tipoComunidad: v.union(
      v.literal("conjuntoResidencial"),
      v.literal("barrio"),
      v.literal("empresa"),
      v.literal("institucion"),
      v.literal("otra"),
    ),
    ciudad: v.string(),
    zona: v.string(),
    liderPrincipalId: v.optional(v.id("lideresRuta")),
    estado: v.union(
      v.literal("activa"),
      v.literal("pausada"),
      v.literal("cerrada"),
    ),
  })
    .index("by_cliente", ["clienteId"])
    .index("by_estado", ["estado"]),

  // =========================================================================
  // OBJECTS — actores
  // =========================================================================

  conductores: defineTable({
    nombre: v.string(),
    cedula: v.string(),
    telefono: v.string(),
    email: v.optional(v.string()),
    licenciaNumero: v.string(),
    licenciaCategoria: v.string(),
    licenciaVence: v.string(), // YYYY-MM-DD
    estado: v.union(
      v.literal("candidato"),
      v.literal("activo"),
      v.literal("suspendido"),
      v.literal("inactivo"),
    ),
    calificacionPromedio: v.optional(v.number()),
    fechaIngreso: v.optional(v.string()),
    notasOperativas: v.optional(v.string()),
  })
    .index("by_estado", ["estado"])
    .index("by_cedula", ["cedula"]),

  propietarios: defineTable({
    nombre: v.string(),
    cedulaONit: v.string(),
    tipoPersona: v.union(v.literal("natural"), v.literal("juridica")),
    telefono: v.string(),
    email: v.optional(v.string()),
    estado: v.union(
      v.literal("activo"),
      v.literal("suspendido"),
      v.literal("inactivo"),
    ),
    cuentaPago: v.optional(v.string()),
    notas: v.optional(v.string()),
  })
    .index("by_estado", ["estado"])
    .index("by_cedulaONit", ["cedulaONit"]),

  vehiculos: defineTable({
    placa: v.string(),
    propietarioId: v.id("propietarios"),
    tipoVehiculo: v.union(
      v.literal("automovil"),
      v.literal("van"),
      v.literal("buseta"),
      v.literal("bus"),
      v.literal("camioneta"),
      v.literal("otro"),
    ),
    marca: v.string(),
    linea: v.string(),
    modelo: v.number(), // año del modelo
    capacidadPasajeros: v.number(),
    color: v.optional(v.string()),
    estado: v.union(
      v.literal("candidato"),
      v.literal("habilitado"),
      v.literal("enMantenimiento"),
      v.literal("suspendido"),
      v.literal("retirado"),
    ),
    gpsActivo: v.boolean(),
    fechaIngreso: v.optional(v.string()),
    notas: v.optional(v.string()),
  })
    .index("by_estado", ["estado"])
    .index("by_placa", ["placa"])
    .index("by_propietario", ["propietarioId"])
    .index("by_tipo_estado", ["tipoVehiculo", "estado"]),

  gestoresValidados: defineTable({
    nombre: v.string(),
    cedulaONit: v.string(),
    telefono: v.string(),
    email: v.optional(v.string()),
    controlaFlota: v.boolean(),
    estado: v.union(
      v.literal("candidato"),
      v.literal("validado"),
      v.literal("suspendido"),
      v.literal("retirado"),
    ),
    fechaValidacion: v.optional(v.string()),
    criteriosValidacion: v.optional(v.string()),
    reglasAsignacion: v.optional(v.string()),
  }).index("by_estado", ["estado"]),

  lideresRuta: defineTable({
    nombre: v.string(),
    cedula: v.string(),
    telefono: v.string(),
    email: v.optional(v.string()),
    comunidadId: v.optional(v.id("comunidades")),
    estado: v.union(
      v.literal("candidato"),
      v.literal("certificado"),
      v.literal("suspendido"),
      v.literal("inactivo"),
    ),
    fechaCertificacion: v.optional(v.string()),
  })
    .index("by_comunidad", ["comunidadId"])
    .index("by_estado", ["estado"]),

  // =========================================================================
  // OBJECTS — identidad, acceso de apps y auditoría
  // =========================================================================

  usuariosSistema: defineTable({
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
    estado: v.union(
      v.literal("activo"),
      v.literal("suspendido"),
      v.literal("inactivo"),
    ),
    creadoEn: v.number(), // epoch ms
  })
    .index("by_tipo_estado", ["tipoUsuario", "estado"])
    .index("by_email", ["email"])
    .index("by_telefono", ["telefono"])
    .index("by_conductor", ["conductorId"]),

  rolesSistema: defineTable({
    nombre: v.string(),
    descripcion: v.optional(v.string()),
    permisos: v.array(v.string()),
    estado: v.union(v.literal("activo"), v.literal("inactivo")),
  }).index("by_nombre", ["nombre"]),

  telegramCuentas: defineTable({
    usuarioSistemaId: v.optional(v.id("usuariosSistema")),
    conductorId: v.optional(v.id("conductores")),
    telefono: v.optional(v.string()),
    telegramUserId: v.string(),
    telegramChatId: v.string(),
    username: v.optional(v.string()),
    estado: v.union(
      v.literal("pendienteVerificacion"),
      v.literal("vinculada"),
      v.literal("suspendida"),
      v.literal("desvinculada"),
    ),
    fechaVinculacion: v.optional(v.number()),
    ultimoComandoEn: v.optional(v.number()),
  })
    .index("by_telegramUserId", ["telegramUserId"])
    .index("by_telegramChatId", ["telegramChatId"])
    .index("by_conductor_estado", ["conductorId", "estado"])
    .index("by_usuarioSistema", ["usuarioSistemaId"]),

  auditoriaAcciones: defineTable({
    actorTipo: v.union(
      v.literal("usuario"),
      v.literal("conductor"),
      v.literal("sistema"),
      v.literal("telegram"),
      v.literal("dashboard"),
    ),
    actorId: v.optional(v.string()), // id serializado del actor (usuario, conductor, cuenta TG…)
    accion: v.string(),
    entidadTipo: v.string(),
    entidadId: v.optional(v.string()),
    timestamp: v.number(),
    origen: v.union(
      v.literal("convex"),
      v.literal("rustInterface"),
      v.literal("webDashboard"),
      v.literal("telegramBot"),
      v.literal("sistema"),
    ),
    resultado: v.union(
      v.literal("ok"),
      v.literal("error"),
      v.literal("rechazado"),
    ),
    detalle: v.optional(v.string()),
  })
    .index("by_entidad_timestamp", ["entidadTipo", "entidadId", "timestamp"])
    .index("by_actor_timestamp", ["actorTipo", "actorId", "timestamp"])
    .index("by_origen_timestamp", ["origen", "timestamp"]),

  // =========================================================================
  // OBJECTS — cumplimiento y seguridad operacional
  // =========================================================================

  documentosCumplimiento: defineTable({
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
    fechaEmision: v.optional(v.string()), // YYYY-MM-DD
    fechaVencimiento: v.optional(v.string()),
    estado: v.union(
      v.literal("vigente"),
      v.literal("porVencer"),
      v.literal("vencido"),
      v.literal("rechazado"),
    ),
    archivoUrl: v.optional(v.string()),
    verificadoPor: v.optional(v.string()),
    fechaVerificacion: v.optional(v.number()),
  })
    .index("by_entidad_estado_vencimiento", ["entidadTipo", "estado", "fechaVencimiento"])
    .index("by_estado_vencimiento", ["estado", "fechaVencimiento"])
    .index("by_conductor", ["conductorId"])
    .index("by_vehiculo", ["vehiculoId"])
    .index("by_propietario", ["propietarioId"])
    .index("by_gestor", ["gestorId"]),

  mantenimientos: defineTable({
    vehiculoId: v.id("vehiculos"),
    tipo: v.union(
      v.literal("preventivo"),
      v.literal("correctivo"),
      v.literal("inspeccion"),
    ),
    fechaProgramada: v.string(), // YYYY-MM-DD
    fechaRealizada: v.optional(v.string()),
    kilometraje: v.optional(v.number()),
    proveedor: v.optional(v.string()),
    resultado: v.union(
      v.literal("pendiente"),
      v.literal("aprobado"),
      v.literal("requiereCorreccion"),
      v.literal("rechazado"),
    ),
    observaciones: v.optional(v.string()),
  })
    .index("by_vehiculo", ["vehiculoId"])
    .index("by_resultado_fecha", ["resultado", "fechaProgramada"]),

  checklistsPreoperativos: defineTable({
    servicioId: v.id("serviciosTransporte"),
    vehiculoId: v.id("vehiculos"),
    conductorId: v.id("conductores"),
    fecha: v.number(), // epoch ms
    combustibleOk: v.boolean(),
    llantasOk: v.boolean(),
    lucesOk: v.boolean(),
    documentosOk: v.boolean(),
    limpiezaOk: v.boolean(),
    gpsOk: v.boolean(),
    observaciones: v.optional(v.string()),
    resultado: v.union(
      v.literal("aprobado"),
      v.literal("aprobadoConObservaciones"),
      v.literal("rechazado"),
    ),
  })
    .index("by_servicio", ["servicioId"])
    .index("by_conductor_fecha", ["conductorId", "fecha"])
    .index("by_vehiculo_fecha", ["vehiculoId", "fecha"]),

  // =========================================================================
  // OBJECTS — trazabilidad y control
  // =========================================================================

  seguimientosGps: defineTable({
    servicioId: v.id("serviciosTransporte"),
    vehiculoId: v.id("vehiculos"),
    conductorId: v.id("conductores"),
    timestamp: v.number(),
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
  })
    .index("by_servicio_timestamp", ["servicioId", "timestamp"])
    .index("by_vehiculo_timestamp", ["vehiculoId", "timestamp"]),

  evidenciasServicio: defineTable({
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
    timestamp: v.number(),
  }).index("by_servicio_timestamp", ["servicioId", "timestamp"]),

  incidencias: defineTable({
    servicioId: v.id("serviciosTransporte"),
    operacionId: v.id("operaciones"),
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
    timestamp: v.number(),
    estado: v.union(
      v.literal("abierta"),
      v.literal("enGestion"),
      v.literal("resuelta"),
      v.literal("cerrada"),
    ),
    responsable: v.optional(v.string()),
    accionCorrectiva: v.optional(v.string()),
    cerradaEn: v.optional(v.number()),
  })
    .index("by_servicio", ["servicioId"])
    .index("by_operacion_estado_severidad", ["operacionId", "estado", "severidad"])
    .index("by_estado_timestamp", ["estado", "timestamp"]),

  // =========================================================================
  // OBJECTS — financiero / desempeño
  // =========================================================================

  tarifasServicio: defineTable({
    servicioId: v.id("serviciosTransporte"),
    valorBase: v.number(),
    valorAdicional: v.optional(v.number()),
    moneda: v.string(), // p.ej. "COP"
    reglaCalculo: v.optional(v.string()),
    estado: v.union(
      v.literal("propuesta"),
      v.literal("aceptada"),
      v.literal("liquidada"),
      v.literal("anulada"),
    ),
  })
    .index("by_servicio", ["servicioId"])
    .index("by_estado", ["estado"]),

  liquidaciones: defineTable({
    servicioId: v.id("serviciosTransporte"),
    propietarioId: v.optional(v.id("propietarios")),
    conductorId: v.optional(v.id("conductores")),
    gestorId: v.optional(v.id("gestoresValidados")),
    valorBruto: v.number(),
    descuentos: v.optional(v.number()),
    bonos: v.optional(v.number()),
    valorNeto: v.number(),
    estado: v.union(
      v.literal("pendiente"),
      v.literal("aprobada"),
      v.literal("pagada"),
      v.literal("retenida"),
    ),
    fechaLiquidacion: v.optional(v.number()),
    observaciones: v.optional(v.string()),
  })
    .index("by_servicio", ["servicioId"])
    .index("by_estado", ["estado"])
    .index("by_propietario_estado", ["propietarioId", "estado"])
    .index("by_conductor_estado", ["conductorId", "estado"])
    .index("by_gestor_estado", ["gestorId", "estado"]),

  evaluacionesDesempeno: defineTable({
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
    periodoInicio: v.string(), // YYYY-MM-DD
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
  })
    .index("by_conductor", ["conductorId"])
    .index("by_vehiculo", ["vehiculoId"])
    .index("by_gestor", ["gestorId"])
    .index("by_operacion", ["operacionId"]),

  // =========================================================================
  // LINKS — relaciones históricas / muchos-a-muchos
  // =========================================================================

  asignacionesServicio: defineTable({
    servicioId: v.id("serviciosTransporte"),
    vehiculoId: v.id("vehiculos"),
    conductorId: v.id("conductores"),
    gestorId: v.optional(v.id("gestoresValidados")),
    asignadoPor: v.string(), // usuarioSistemaId serializado o "sistema"
    fechaAsignacion: v.number(),
    estado: v.union(
      v.literal("propuesta"),
      v.literal("confirmada"),
      v.literal("rechazada"),
      v.literal("reemplazada"),
      v.literal("completada"),
      v.literal("cancelada"), // el servicio se canceló/falló con esta asignación activa
    ),
    motivoReemplazo: v.optional(v.string()),
  })
    .index("by_servicio_estado", ["servicioId", "estado"])
    .index("by_conductor_estado", ["conductorId", "estado"])
    .index("by_vehiculo_estado", ["vehiculoId", "estado"])
    .index("by_gestor_estado", ["gestorId", "estado"]),

  vinculacionesPropietarioVehiculo: defineTable({
    propietarioId: v.id("propietarios"),
    vehiculoId: v.id("vehiculos"),
    fechaDesde: v.string(), // YYYY-MM-DD
    fechaHasta: v.optional(v.string()),
    estado: v.union(
      v.literal("activa"),
      v.literal("finalizada"),
      v.literal("suspendida"),
    ),
  })
    .index("by_propietario_estado", ["propietarioId", "estado"])
    .index("by_vehiculo_estado", ["vehiculoId", "estado"]),

  habilitacionesConductorVehiculo: defineTable({
    conductorId: v.id("conductores"),
    vehiculoId: v.id("vehiculos"),
    fechaDesde: v.string(),
    fechaHasta: v.optional(v.string()),
    estado: v.union(
      v.literal("habilitado"),
      v.literal("suspendido"),
      v.literal("vencido"),
    ),
    observaciones: v.optional(v.string()),
  })
    .index("by_conductor_estado", ["conductorId", "estado"])
    .index("by_vehiculo_estado", ["vehiculoId", "estado"]),

  vehiculosGestor: defineTable({
    gestorId: v.id("gestoresValidados"),
    vehiculoId: v.id("vehiculos"),
    fechaDesde: v.string(),
    fechaHasta: v.optional(v.string()),
    estado: v.union(
      v.literal("activo"),
      v.literal("suspendido"),
      v.literal("retirado"),
    ),
  })
    .index("by_gestor_estado", ["gestorId", "estado"])
    .index("by_vehiculo", ["vehiculoId"]),

  conductoresGestor: defineTable({
    gestorId: v.id("gestoresValidados"),
    conductorId: v.id("conductores"),
    fechaDesde: v.string(),
    fechaHasta: v.optional(v.string()),
    estado: v.union(
      v.literal("activo"),
      v.literal("suspendido"),
      v.literal("retirado"),
    ),
  })
    .index("by_gestor_estado", ["gestorId", "estado"])
    .index("by_conductor", ["conductorId"]),

  participantesOperacion: defineTable({
    operacionId: v.id("operaciones"),
    actorTipo: v.union(
      v.literal("coordinador"),
      v.literal("auxiliar"),
      v.literal("cliente"),
      v.literal("liderRuta"),
      v.literal("gestor"),
      v.literal("conductor"),
      v.literal("propietario"),
    ),
    actorId: v.string(), // id serializado según actorTipo
    rol: v.string(),
    fechaDesde: v.string(),
    fechaHasta: v.optional(v.string()),
    estado: v.union(v.literal("activo"), v.literal("finalizado")),
  })
    .index("by_operacion_estado", ["operacionId", "estado"])
    .index("by_actor", ["actorTipo", "actorId"]),

  pasajerosServicio: defineTable({
    servicioId: v.id("serviciosTransporte"),
    nombre: v.optional(v.string()),
    identificacion: v.optional(v.string()),
    telefono: v.optional(v.string()),
    puntoAbordajeId: v.optional(v.id("paradas")),
    estado: v.union(
      v.literal("programado"),
      v.literal("abordo"),
      v.literal("noShow"),
      v.literal("cancelado"),
      v.literal("finalizado"),
    ),
  }).index("by_servicio_estado", ["servicioId", "estado"]),

  usuariosRoles: defineTable({
    usuarioSistemaId: v.id("usuariosSistema"),
    rolSistemaId: v.id("rolesSistema"),
    fechaDesde: v.string(),
    fechaHasta: v.optional(v.string()),
    estado: v.union(v.literal("activo"), v.literal("revocado")),
  })
    .index("by_usuario_estado", ["usuarioSistemaId", "estado"])
    .index("by_rol", ["rolSistemaId"]),
});
