/**
 * Semillas de desarrollo - SOLO para el deployment local.
 *
 * Crea un dataset demo amplio para que el dashboard muestre datos en sus
 * paneles principales: resumen, despacho, incidencias, cumplimiento, eventos,
 * liquidaciones, Telegram y maestros.
 */
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";

const DEMO_NIT = "DEMO-AUGE-900001";
const LEGACY_DEMO_NIT = "900123456-7";

function isoDesdeAhora(dias: number) {
  return new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);
}

function msEnFecha(fecha: string, hora: string) {
  return new Date(`${fecha}T${hora}:00-05:00`).getTime();
}

async function retirarSemillaMinimaAnterior(ctx: MutationCtx) {
  const clientes = await ctx.db.query("clientes").collect();
  const legado = clientes.find((cliente) => cliente.nit === LEGACY_DEMO_NIT);
  if (legado !== undefined && legado.estado !== "inactivo") {
    await ctx.db.patch(legado._id, {
      estado: "inactivo",
      notas: "Retirado por semilla demo ampliada.",
    });
  }

  if (legado !== undefined) {
    const programas = await ctx.db
      .query("programasMovilidad")
      .withIndex("by_cliente", (q) => q.eq("clienteId", legado._id))
      .collect();
    for (const programa of programas) {
      if (programa.estado !== "cerrado") await ctx.db.patch(programa._id, { estado: "cerrado" });
      const operaciones = await ctx.db
        .query("operaciones")
        .withIndex("by_programa", (q) => q.eq("programaId", programa._id))
        .collect();
      for (const operacion of operaciones) {
        if (operacion.estado !== "cerrada") {
          await ctx.db.patch(operacion._id, { estado: "cerrada" });
        }
      }
    }
  }

  const conductoresDemo = await ctx.db
    .query("conductores")
    .withIndex("by_cedula", (q) => q.eq("cedula", "1035678901"))
    .collect();
  const conductoresOrdenados = conductoresDemo.sort((a, b) => b._creationTime - a._creationTime);
  for (const conductor of conductoresOrdenados.slice(1)) {
    if (conductor.estado !== "inactivo") {
      await ctx.db.patch(conductor._id, {
        estado: "inactivo",
        notasOperativas: "Retirado por semilla demo ampliada.",
      });
    }
  }

  const vehiculosDemo = await ctx.db
    .query("vehiculos")
    .withIndex("by_placa", (q) => q.eq("placa", "WXY123"))
    .collect();
  const vehiculosOrdenados = vehiculosDemo.sort((a, b) => b._creationTime - a._creationTime);
  for (const vehiculo of vehiculosOrdenados.slice(1)) {
    if (vehiculo.estado !== "retirado") {
      await ctx.db.patch(vehiculo._id, {
        estado: "retirado",
        notas: "Retirado por semilla demo ampliada.",
      });
    }
  }
}

export const sembrarDatosDemo = internalMutation({
  args: {},
  returns: v.object({
    estado: v.union(v.literal("creado"), v.literal("yaExistia")),
    clientes: v.number(),
    programas: v.number(),
    operaciones: v.number(),
    rutas: v.number(),
    vehiculos: v.number(),
    conductores: v.number(),
    servicios: v.number(),
    incidenciasAbiertas: v.number(),
    usuariosSistema: v.number(),
    telegramPendientes: v.number(),
  }),
  handler: async (ctx) => {
    await retirarSemillaMinimaAnterior(ctx);

    const clientesExistentes = await ctx.db.query("clientes").collect();
    if (clientesExistentes.some((cliente) => cliente.nit === DEMO_NIT)) {
      return {
        estado: "yaExistia" as const,
        clientes: clientesExistentes.length,
        programas: (await ctx.db.query("programasMovilidad").collect()).length,
        operaciones: (await ctx.db.query("operaciones").collect()).length,
        rutas: (await ctx.db.query("rutas").collect()).length,
        vehiculos: (await ctx.db.query("vehiculos").collect()).length,
        conductores: (await ctx.db.query("conductores").collect()).length,
        servicios: (await ctx.db.query("serviciosTransporte").collect()).length,
        incidenciasAbiertas: (
          await ctx.db
            .query("incidencias")
            .withIndex("by_estado_timestamp", (q) => q.eq("estado", "abierta"))
            .collect()
        ).length,
        usuariosSistema: (await ctx.db.query("usuariosSistema").collect()).length,
        telegramPendientes: (
          await ctx.db
            .query("telegramCuentas")
            .withIndex("by_estado", (q) => q.eq("estado", "pendienteVerificacion"))
            .collect()
        ).length,
      };
    }

    const hoy = isoDesdeAhora(0);
    const ayer = isoDesdeAhora(-1);
    const manana = isoDesdeAhora(1);
    const enCincoDias = isoDesdeAhora(5);
    const enDiezDias = isoDesdeAhora(10);
    const enUnMes = isoDesdeAhora(30);
    const enUnAno = isoDesdeAhora(365);
    const haceUnMes = isoDesdeAhora(-30);

    const clienteCorporativoId = await ctx.db.insert("clientes", {
      nombre: "Demo Corporativo Andino S.A.S.",
      tipo: "empresa",
      nit: DEMO_NIT,
      contactoPrincipal: "Valentina Rojas",
      telefono: "+57 300 111 2233",
      email: "operaciones@corporativoandino.demo",
      direccion: "Cra 43A # 7-50",
      ciudad: "Medellin",
      estado: "activo",
      notas: "Cliente marcador de la semilla demo.",
    });
    const clienteSaludId = await ctx.db.insert("clientes", {
      nombre: "Clinica Santa Aurora",
      tipo: "institucion",
      nit: "DEMO-AUGE-830222",
      contactoPrincipal: "Mateo Arango",
      telefono: "+57 604 444 8811",
      email: "logistica@santaaurora.demo",
      direccion: "Calle 10 # 35-20",
      ciudad: "Medellin",
      estado: "activo",
    });
    const clienteEventoId = await ctx.db.insert("clientes", {
      nombre: "Feria ExpoMovilidad 2026",
      tipo: "evento",
      nit: "DEMO-AUGE-EXPO26",
      contactoPrincipal: "Camila Torres",
      telefono: "+57 315 220 3300",
      email: "produccion@expomovilidad.demo",
      direccion: "Plaza Mayor",
      ciudad: "Medellin",
      estado: "activo",
    });

    const programaLaboralId = await ctx.db.insert("programasMovilidad", {
      clienteId: clienteCorporativoId,
      tipoServicio: "recurrente",
      nombre: "Rutas laborales valle norte",
      descripcion: "Transporte recurrente de colaboradores entre estaciones Metro y planta.",
      fechaInicio: haceUnMes,
      estado: "activo",
      modalidadPago: "credito",
      requiereReportePeriodico: true,
      reglasOperativas: "Confirmacion del conductor 45 minutos antes de cada salida.",
    });
    const programaSaludId = await ctx.db.insert("programasMovilidad", {
      clienteId: clienteSaludId,
      tipoServicio: "puntual",
      nombre: "Traslados personal asistencial",
      descripcion: "Servicios puntuales para personal de turnos extendidos.",
      fechaInicio: haceUnMes,
      estado: "activo",
      modalidadPago: "mixto",
      requiereReportePeriodico: false,
    });
    const programaEventoId = await ctx.db.insert("programasMovilidad", {
      clienteId: clienteEventoId,
      tipoServicio: "evento",
      nombre: "Operativo ExpoMovilidad",
      descripcion: "Movilidad de staff, invitados y coordinadores del evento.",
      fechaInicio: hoy,
      fechaFin: enCincoDias,
      estado: "activo",
      modalidadPago: "prepago",
      requiereReportePeriodico: true,
      reglasOperativas: "Centro de control activo durante montaje y operacion.",
    });

    const operacionLaboralId = await ctx.db.insert("operaciones", {
      programaId: programaLaboralId,
      nombre: "Operacion laboral norte",
      tipoOperacion: "recurrente",
      ciudadBase: "Medellin",
      zonaOperacion: "Bello - Copacabana - Girardota",
      fechaInicio: haceUnMes,
      estado: "enCurso",
      responsableOperativo: "Sofia Marin",
      nivelControl: "controlado",
      requiereCentroControl: false,
    });
    const operacionSaludId = await ctx.db.insert("operaciones", {
      programaId: programaSaludId,
      nombre: "Turnos clinica nocturna",
      tipoOperacion: "puntual",
      ciudadBase: "Medellin",
      zonaOperacion: "Poblado - Laureles - Belen",
      fechaInicio: hoy,
      estado: "planificada",
      responsableOperativo: "Jorge Cardenas",
      nivelControl: "basico",
      requiereCentroControl: false,
    });
    const operacionEventoId = await ctx.db.insert("operaciones", {
      programaId: programaEventoId,
      nombre: "Comando ExpoMovilidad",
      tipoOperacion: "evento",
      ciudadBase: "Medellin",
      zonaOperacion: "Plaza Mayor - hoteles aliados",
      fechaInicio: hoy,
      fechaFin: enCincoDias,
      estado: "enCurso",
      responsableOperativo: "Natalia Perez",
      nivelControl: "comandoOperativo",
      requiereCentroControl: true,
    });

    const rutaNorteId = await ctx.db.insert("rutas", {
      programaId: programaLaboralId,
      nombre: "Ruta N1 Metro Niquia - Planta",
      tipoRuta: "laboral",
      origenPrincipal: "Estacion Niquia",
      destinoPrincipal: "Planta Norte",
      activa: true,
      frecuencia: "diaria",
      capacidadObjetivo: 42,
      reglasAbordaje: "Validar lista antes de salir de cada parada.",
    });
    const rutaSurId = await ctx.db.insert("rutas", {
      programaId: programaLaboralId,
      nombre: "Ruta S2 Industriales - Planta",
      tipoRuta: "laboral",
      origenPrincipal: "Estacion Industriales",
      destinoPrincipal: "Planta Norte",
      activa: true,
      frecuencia: "diaria",
      capacidadObjetivo: 30,
    });
    const rutaEventoId = await ctx.db.insert("rutas", {
      programaId: programaEventoId,
      nombre: "Hotel San Fernando - Plaza Mayor",
      tipoRuta: "evento",
      origenPrincipal: "Hotel San Fernando Plaza",
      destinoPrincipal: "Plaza Mayor",
      activa: true,
      frecuencia: "personalizada",
      capacidadObjetivo: 18,
    });

    for (const [rutaId, paradas] of [
      [
        rutaNorteId,
        [
          ["Niquia", "Estacion Metro Niquia", "05:10", "05:20", 6.337, -75.544],
          ["Puerta del Norte", "CC Puerta del Norte", "05:25", "05:35", 6.328, -75.546],
          ["Planta Norte", "Porteria principal planta", "06:05", "06:15", 6.373, -75.448],
        ],
      ],
      [
        rutaSurId,
        [
          ["Industriales", "Estacion Metro Industriales", "05:30", "05:40", 6.231, -75.575],
          ["San Diego", "Glorieta San Diego", "05:45", "05:55", 6.239, -75.568],
          ["Planta Norte", "Porteria principal planta", "06:40", "06:50", 6.373, -75.448],
        ],
      ],
      [
        rutaEventoId,
        [
          ["Lobby hotel", "Cra 42A # 1-15", "08:00", "08:10", 6.200, -75.571],
          ["Plaza Mayor", "Calle 41 # 55-80", "08:25", "08:35", 6.243, -75.575],
        ],
      ],
    ] as const) {
      let orden = 1;
      for (const [nombre, direccionTexto, ventanaInicio, ventanaFin, lat, lng] of paradas) {
        await ctx.db.insert("paradas", {
          rutaId,
          nombre,
          orden,
          direccionTexto,
          geo: { lat, lng },
          ventanaInicio,
          ventanaFin,
          activa: true,
        });
        orden += 1;
      }
    }

    const eventoId = await ctx.db.insert("eventos", {
      clienteId: clienteEventoId,
      programaId: programaEventoId,
      nombre: "ExpoMovilidad 2026 - dia de montaje",
      sedePrincipal: "Plaza Mayor Medellin",
      fechaInicio: hoy,
      fechaFin: enCincoDias,
      aforoEstimado: 3200,
      nivelComplejidad: "alto",
      modeloOperacion: "comandoOperativo",
      estado: "enCurso",
    });

    const propietarioIds = [];
    for (const propietario of [
      ["Transportes Horizonte S.A.S.", "901300111", "juridica", "+57 604 555 0101"],
      ["Carlos Restrepo", "71456789", "natural", "+57 310 555 8899"],
      ["Movilidad Integral Las Palmas", "900456222", "juridica", "+57 604 555 0202"],
    ] as const) {
      propietarioIds.push(
        await ctx.db.insert("propietarios", {
          nombre: propietario[0],
          cedulaONit: propietario[1],
          tipoPersona: propietario[2],
          telefono: propietario[3],
          email: `${propietario[1]}@demo.auge`,
          estado: "activo",
          cuentaPago: "Cuenta bancaria demo",
        }),
      );
    }

    const vehiculos = [
      {
        placa: "WXY123",
        propietarioId: propietarioIds[0],
        tipoVehiculo: "van" as const,
        marca: "Renault",
        linea: "Master",
        modelo: 2023,
        capacidadPasajeros: 15,
        color: "Blanco",
        estado: "habilitado" as const,
        gpsActivo: true,
      },
      {
        placa: "KLM842",
        propietarioId: propietarioIds[0],
        tipoVehiculo: "buseta" as const,
        marca: "Chevrolet",
        linea: "NPR",
        modelo: 2022,
        capacidadPasajeros: 28,
        color: "Gris",
        estado: "habilitado" as const,
        gpsActivo: true,
      },
      {
        placa: "JPN507",
        propietarioId: propietarioIds[1],
        tipoVehiculo: "automovil" as const,
        marca: "Toyota",
        linea: "Corolla",
        modelo: 2024,
        capacidadPasajeros: 4,
        color: "Negro",
        estado: "habilitado" as const,
        gpsActivo: true,
      },
      {
        placa: "MNT229",
        propietarioId: propietarioIds[2],
        tipoVehiculo: "van" as const,
        marca: "Mercedes-Benz",
        linea: "Sprinter",
        modelo: 2021,
        capacidadPasajeros: 18,
        color: "Plata",
        estado: "enMantenimiento" as const,
        gpsActivo: false,
      },
      {
        placa: "QRS614",
        propietarioId: propietarioIds[2],
        tipoVehiculo: "camioneta" as const,
        marca: "Nissan",
        linea: "Frontier",
        modelo: 2020,
        capacidadPasajeros: 4,
        color: "Azul",
        estado: "habilitado" as const,
        gpsActivo: true,
      },
    ];
    const vehiculoIds = [];
    for (const vehiculo of vehiculos) {
      const vehiculoId = await ctx.db.insert("vehiculos", {
        ...vehiculo,
        fechaIngreso: haceUnMes,
      });
      vehiculoIds.push(vehiculoId);
      await ctx.db.insert("vinculacionesPropietarioVehiculo", {
        propietarioId: vehiculo.propietarioId,
        vehiculoId,
        fechaDesde: haceUnMes,
        estado: "activa",
      });
    }

    const conductores = [
      ["Andres Zapata", "1035678901", "+57 301 444 5566", "C2", "activo", 4.8],
      ["Mariana Gil", "1019988776", "+57 302 444 7788", "C2", "activo", 4.7],
      ["Julian Mejia", "98555123", "+57 303 222 1199", "B1", "activo", 4.5],
      ["Paola Henao", "43777111", "+57 304 919 2020", "C1", "suspendido", 4.1],
      ["Diego Salazar", "1122334455", "+57 305 101 9090", "C2", "activo", 4.6],
    ] as const;
    const conductorIds = [];
    for (const [nombre, cedula, telefono, licenciaCategoria, estado, calificacionPromedio] of conductores) {
      conductorIds.push(
        await ctx.db.insert("conductores", {
          nombre,
          cedula,
          telefono,
          email: `${cedula}@conductores.demo`,
          licenciaNumero: cedula,
          licenciaCategoria,
          licenciaVence: estado === "suspendido" ? ayer : enUnAno,
          estado,
          calificacionPromedio,
          fechaIngreso: haceUnMes,
        }),
      );
    }

    for (let i = 0; i < 4; i += 1) {
      await ctx.db.insert("habilitacionesConductorVehiculo", {
        conductorId: conductorIds[i],
        vehiculoId: vehiculoIds[i],
        fechaDesde: haceUnMes,
        estado: i === 3 ? "suspendido" : "habilitado",
      });
    }
    await ctx.db.insert("habilitacionesConductorVehiculo", {
      conductorId: conductorIds[4],
      vehiculoId: vehiculoIds[4],
      fechaDesde: haceUnMes,
      estado: "habilitado",
    });

    const gestorId = await ctx.db.insert("gestoresValidados", {
      nombre: "Gestor Ruta Segura",
      cedulaONit: "DEMO-GESTOR-01",
      telefono: "+57 316 787 1212",
      email: "ruta.segura@demo.auge",
      controlaFlota: true,
      estado: "validado",
      fechaValidacion: haceUnMes,
      criteriosValidacion: "Documentacion y experiencia verificadas.",
    });
    await ctx.db.insert("vehiculosGestor", {
      gestorId,
      vehiculoId: vehiculoIds[1],
      fechaDesde: haceUnMes,
      estado: "activo",
    });
    await ctx.db.insert("conductoresGestor", {
      gestorId,
      conductorId: conductorIds[1],
      fechaDesde: haceUnMes,
      estado: "activo",
    });

    const documentos = [
      ["vehiculo", vehiculoIds[0], undefined, "soat", enUnAno, "vigente"],
      ["vehiculo", vehiculoIds[0], undefined, "tecnomecanica", enDiezDias, "porVencer"],
      ["vehiculo", vehiculoIds[1], undefined, "soat", enUnAno, "vigente"],
      ["vehiculo", vehiculoIds[2], undefined, "soat", ayer, "vencido"],
      ["conductor", undefined, conductorIds[0], "licencia", enUnAno, "vigente"],
      ["conductor", undefined, conductorIds[1], "licencia", enDiezDias, "porVencer"],
      ["conductor", undefined, conductorIds[2], "licencia", enUnAno, "vigente"],
      ["conductor", undefined, conductorIds[4], "capacitacion", enCincoDias, "porVencer"],
    ] as const;
    for (const [entidadTipo, vehiculoId, conductorId, tipoDocumento, fechaVencimiento, estado] of documentos) {
      await ctx.db.insert("documentosCumplimiento", {
        entidadTipo,
        vehiculoId,
        conductorId,
        tipoDocumento,
        numero: `DEMO-${tipoDocumento}-${fechaVencimiento}`,
        fechaEmision: haceUnMes,
        fechaVencimiento,
        estado,
        verificadoPor: "Semilla demo",
        fechaVerificacion: Date.now(),
      });
    }

    await ctx.db.insert("mantenimientos", {
      vehiculoId: vehiculoIds[3],
      tipo: "correctivo",
      fechaProgramada: hoy,
      resultado: "pendiente",
      observaciones: "Revision de GPS y sistema electrico.",
    });
    await ctx.db.insert("mantenimientos", {
      vehiculoId: vehiculoIds[1],
      tipo: "preventivo",
      fechaProgramada: enCincoDias,
      resultado: "pendiente",
    });

    const adminId = await ctx.db.insert("usuariosSistema", {
      nombre: "Admin Demo",
      email: "admin@augemovilidad.demo",
      tipoUsuario: "admin",
      estado: "activo",
      creadoEn: Date.now(),
    });
    const despachadorId = await ctx.db.insert("usuariosSistema", {
      nombre: "Despachador Demo",
      email: "despacho@augemovilidad.demo",
      tipoUsuario: "operadorLogistico",
      estado: "activo",
      creadoEn: Date.now(),
    });
    const coordinadorId = await ctx.db.insert("usuariosSistema", {
      nombre: "Coordinadora Evento Demo",
      email: "coordinacion@augemovilidad.demo",
      telefono: "+57 317 000 1111",
      tipoUsuario: "coordinador",
      estado: "activo",
      creadoEn: Date.now(),
    });
    await ctx.db.insert("usuariosSistema", {
      nombre: "Andres Zapata",
      email: "andres.zapata@conductores.demo",
      telefono: "+57 301 444 5566",
      tipoUsuario: "conductor",
      conductorId: conductorIds[0],
      estado: "activo",
      creadoEn: Date.now(),
    });

    await ctx.db.insert("telegramCuentas", {
      conductorId: conductorIds[0],
      telegramUserId: "tg-demo-1001",
      telegramChatId: "chat-demo-1001",
      username: "andres_zapata_demo",
      estado: "vinculada",
      fechaVinculacion: Date.now() - 2 * 86_400_000,
      ultimoComandoEn: Date.now() - 15 * 60_000,
    });
    await ctx.db.insert("telegramCuentas", {
      telefono: "+57 302 444 7788",
      telegramUserId: "tg-demo-pendiente-1002",
      telegramChatId: "chat-demo-1002",
      username: "mariana_gil_demo",
      estado: "pendienteVerificacion",
      fechaVinculacion: Date.now() - 30 * 60_000,
    });

    await ctx.db.insert("participantesOperacion", {
      operacionId: operacionEventoId,
      actorTipo: "coordinador",
      actorId: coordinadorId,
      rol: "Coordinacion general",
      fechaDesde: hoy,
      estado: "activo",
    });
    await ctx.db.insert("participantesOperacion", {
      operacionId: operacionEventoId,
      actorTipo: "auxiliar",
      actorId: adminId,
      rol: "Centro de control",
      fechaDesde: hoy,
      estado: "activo",
    });

    const solicitudId = await ctx.db.insert("solicitudesServicio", {
      clienteId: clienteSaludId,
      programaId: programaSaludId,
      tipoServicio: "puntual",
      fechaSolicitud: Date.now() - 2 * 60 * 60_000,
      origenTexto: "Clinica Santa Aurora",
      destinoTexto: "Barrio Laureles",
      fechaHoraRequerida: msEnFecha(hoy, "21:30"),
      cantidadPasajerosEstimada: 3,
      tipoVehiculoRequerido: "automovil",
      requisitosEspeciales: "Salida por porteria urgencias.",
      estado: "validada",
    });

    const servicios = [
      {
        operacionId: operacionLaboralId,
        rutaId: rutaNorteId,
        fechaProgramada: hoy,
        horaInicioProgramada: "05:20",
        horaFinProgramada: "06:20",
        origenTexto: "Estacion Niquia",
        destinoTexto: "Planta Norte",
        tipoVehiculoRequerido: "van" as const,
        estado: "programado" as const,
        prioridad: "alta" as const,
        tarifaAcordada: 185000,
      },
      {
        operacionId: operacionLaboralId,
        rutaId: rutaSurId,
        fechaProgramada: hoy,
        horaInicioProgramada: "06:00",
        horaFinProgramada: "07:10",
        origenTexto: "Estacion Industriales",
        destinoTexto: "Planta Norte",
        tipoVehiculoRequerido: "buseta" as const,
        estado: "asignado" as const,
        prioridad: "normal" as const,
        tarifaAcordada: 260000,
      },
      {
        operacionId: operacionEventoId,
        rutaId: rutaEventoId,
        fechaProgramada: hoy,
        horaInicioProgramada: "08:10",
        horaFinProgramada: "08:45",
        origenTexto: "Hotel San Fernando Plaza",
        destinoTexto: "Plaza Mayor",
        tipoVehiculoRequerido: "van" as const,
        estado: "enPreparacion" as const,
        prioridad: "critica" as const,
        tarifaAcordada: 160000,
      },
      {
        operacionId: operacionEventoId,
        rutaId: rutaEventoId,
        fechaProgramada: hoy,
        horaInicioProgramada: "09:00",
        horaFinProgramada: "09:45",
        origenTexto: "Plaza Mayor",
        destinoTexto: "Hotel San Fernando Plaza",
        tipoVehiculoRequerido: "camioneta" as const,
        estado: "enCurso" as const,
        prioridad: "alta" as const,
        tarifaAcordada: 140000,
        inicioRealTimestamp: msEnFecha(hoy, "09:04"),
      },
      {
        operacionId: operacionSaludId,
        solicitudId,
        fechaProgramada: hoy,
        horaInicioProgramada: "21:30",
        horaFinProgramada: "22:00",
        origenTexto: "Clinica Santa Aurora",
        destinoTexto: "Barrio Laureles",
        tipoVehiculoRequerido: "automovil" as const,
        estado: "programado" as const,
        prioridad: "normal" as const,
        tarifaAcordada: 70000,
      },
      {
        operacionId: operacionLaboralId,
        rutaId: rutaNorteId,
        fechaProgramada: ayer,
        horaInicioProgramada: "17:10",
        horaFinProgramada: "18:10",
        origenTexto: "Planta Norte",
        destinoTexto: "Estacion Niquia",
        tipoVehiculoRequerido: "van" as const,
        estado: "completado" as const,
        prioridad: "normal" as const,
        tarifaAcordada: 185000,
        inicioRealTimestamp: msEnFecha(ayer, "17:12"),
        finRealTimestamp: msEnFecha(ayer, "18:07"),
        cantidadPasajerosReal: 13,
      },
      {
        operacionId: operacionEventoId,
        fechaProgramada: manana,
        horaInicioProgramada: "07:30",
        horaFinProgramada: "08:10",
        origenTexto: "Hotel Laureles Plaza",
        destinoTexto: "Plaza Mayor",
        tipoVehiculoRequerido: "buseta" as const,
        estado: "cancelado" as const,
        prioridad: "normal" as const,
        tarifaAcordada: 210000,
        observaciones: "Cancelado por cambio de agenda del cliente.",
      },
    ];

    const servicioIds = [];
    for (const servicio of servicios) {
      servicioIds.push(
        await ctx.db.insert("serviciosTransporte", {
          cantidadPasajerosProgramada: servicio.tipoVehiculoRequerido === "automovil" ? 3 : 14,
          origenGeo: { lat: 6.244, lng: -75.574 },
          destinoGeo: { lat: 6.268, lng: -75.569 },
          ...servicio,
        }),
      );
    }

    const asignaciones = [
      [servicioIds[1], vehiculoIds[1], conductorIds[1], "confirmada", gestorId],
      [servicioIds[2], vehiculoIds[0], conductorIds[0], "confirmada", undefined],
      [servicioIds[3], vehiculoIds[4], conductorIds[4], "confirmada", undefined],
      [servicioIds[5], vehiculoIds[0], conductorIds[0], "completada", undefined],
    ] as const;
    for (const [servicioId, vehiculoId, conductorId, estado, gestorAsignacionId] of asignaciones) {
      await ctx.db.insert("asignacionesServicio", {
        servicioId,
        vehiculoId,
        conductorId,
        gestorId: gestorAsignacionId,
        asignadoPor: despachadorId,
        fechaAsignacion: Date.now() - 90 * 60_000,
        estado,
      });
    }

    await ctx.db.insert("checklistsPreoperativos", {
      servicioId: servicioIds[2],
      vehiculoId: vehiculoIds[0],
      conductorId: conductorIds[0],
      fecha: Date.now() - 35 * 60_000,
      combustibleOk: true,
      llantasOk: true,
      lucesOk: true,
      documentosOk: true,
      limpiezaOk: true,
      gpsOk: true,
      resultado: "aprobado",
    });
    await ctx.db.insert("checklistsPreoperativos", {
      servicioId: servicioIds[3],
      vehiculoId: vehiculoIds[4],
      conductorId: conductorIds[4],
      fecha: Date.now() - 70 * 60_000,
      combustibleOk: true,
      llantasOk: true,
      lucesOk: true,
      documentosOk: true,
      limpiezaOk: false,
      gpsOk: true,
      observaciones: "Limpieza externa pendiente, no bloqueante.",
      resultado: "aprobadoConObservaciones",
    });

    for (const [servicioId, vehiculoId, conductorId, baseHora] of [
      [servicioIds[3], vehiculoIds[4], conductorIds[4], "09:04"],
      [servicioIds[5], vehiculoIds[0], conductorIds[0], "17:12"],
    ] as const) {
      const base = msEnFecha(servicios[servicioIds.indexOf(servicioId)].fechaProgramada, baseHora);
      await ctx.db.insert("seguimientosGps", {
        servicioId,
        vehiculoId,
        conductorId,
        timestamp: base,
        lat: 6.243,
        lng: -75.575,
        velocidad: 0,
        fuente: "appConductor",
        evento: "inicio",
      });
      await ctx.db.insert("seguimientosGps", {
        servicioId,
        vehiculoId,
        conductorId,
        timestamp: base + 12 * 60_000,
        lat: 6.251,
        lng: -75.569,
        velocidad: 36,
        fuente: "gpsVehiculo",
        evento: "ubicacion",
      });
      await ctx.db.insert("seguimientosGps", {
        servicioId,
        vehiculoId,
        conductorId,
        timestamp: base + 28 * 60_000,
        lat: 6.267,
        lng: -75.560,
        velocidad: 0,
        fuente: "gpsVehiculo",
        evento: servicioId === servicioIds[5] ? "finalizacion" : "ubicacion",
      });
    }

    await ctx.db.insert("evidenciasServicio", {
      servicioId: servicioIds[3],
      tipo: "telegram",
      descripcion: "Conductor reporta llegada a punto de recogida.",
      creadoPorTipo: "telegram",
      creadoPorId: conductorIds[4],
      timestamp: Date.now() - 50 * 60_000,
    });
    await ctx.db.insert("evidenciasServicio", {
      servicioId: servicioIds[5],
      tipo: "comentario",
      descripcion: "Servicio cerrado sin novedades.",
      creadoPorTipo: "conductor",
      creadoPorId: conductorIds[0],
      timestamp: msEnFecha(ayer, "18:08"),
    });

    await ctx.db.insert("incidencias", {
      servicioId: servicioIds[0],
      operacionId: operacionLaboralId,
      tipo: "retraso",
      severidad: "alta",
      descripcion: "Vehiculo asignado por confirmar; riesgo de retraso en salida Niquia.",
      timestamp: Date.now() - 25 * 60_000,
      estado: "abierta",
      responsable: "Despacho",
    });
    await ctx.db.insert("incidencias", {
      servicioId: servicioIds[3],
      operacionId: operacionEventoId,
      tipo: "contingencia",
      severidad: "critica",
      descripcion: "Cierre vial temporal cerca de Plaza Mayor; se activa ruta alterna.",
      timestamp: Date.now() - 18 * 60_000,
      estado: "enGestion",
      responsable: "Centro de control",
      accionCorrectiva: "Monitorear desvio por Avenida Ferrocarril.",
    });
    await ctx.db.insert("incidencias", {
      servicioId: servicioIds[5],
      operacionId: operacionLaboralId,
      tipo: "queja",
      severidad: "media",
      descripcion: "Pasajero reporto temperatura alta en cabina.",
      timestamp: msEnFecha(ayer, "18:20"),
      estado: "resuelta",
      responsable: "Calidad",
      accionCorrectiva: "Revision de aire acondicionado.",
      cerradaEn: msEnFecha(ayer, "19:00"),
    });

    for (const [servicioId, propietarioId, conductorId, estado, valorNeto] of [
      [servicioIds[1], propietarioIds[0], undefined, "pendiente", 235000],
      [servicioIds[3], propietarioIds[2], conductorIds[4], "aprobada", 125000],
      [servicioIds[5], propietarioIds[0], conductorIds[0], "pagada", 170000],
      [servicioIds[0], propietarioIds[1], undefined, "retenida", 150000],
    ] as const) {
      await ctx.db.insert("liquidaciones", {
        servicioId,
        propietarioId,
        conductorId,
        valorBruto: valorNeto + 15000,
        descuentos: estado === "retenida" ? 15000 : 0,
        bonos: estado === "aprobada" ? 5000 : 0,
        valorNeto,
        estado,
        fechaLiquidacion: Date.now(),
        observaciones: estado === "retenida" ? "Pendiente soporte de novedades." : undefined,
      });
    }

    await ctx.db.insert("tarifasServicio", {
      servicioId: servicioIds[0],
      valorBase: 185000,
      moneda: "COP",
      reglaCalculo: "Ruta laboral tarifa fija",
      estado: "aceptada",
    });
    await ctx.db.insert("evaluacionesDesempeno", {
      entidadTipo: "operacion",
      operacionId: operacionLaboralId,
      periodoInicio: haceUnMes,
      periodoFin: hoy,
      puntualidadScore: 92,
      seguridadScore: 98,
      cumplimientoScore: 90,
      quejasCount: 1,
      incidenciasCount: 2,
      resultado: "bueno",
    });

    return {
      estado: "creado" as const,
      clientes: 3,
      programas: 3,
      operaciones: 3,
      rutas: 3,
      vehiculos: vehiculoIds.length,
      conductores: conductorIds.length,
      servicios: servicioIds.length,
      incidenciasAbiertas: 2,
      usuariosSistema: 4,
      telegramPendientes: 1,
    };
  },
});
