/**
 * Semillas de desarrollo — SOLO para el deployment local.
 *
 * Crea el mínimo de actores para ejercitar el flujo completo de un servicio:
 * cliente → programa → operación + propietario → vehículo → conductor
 * (con habilitación, vinculación, documentos vigentes), un usuario despachador
 * y una cuenta de Telegram vinculada al conductor.
 */
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

export const sembrarDatosDemo = internalMutation({
  args: {},
  returns: v.object({
    clienteId: v.id("clientes"),
    programaId: v.id("programasMovilidad"),
    operacionId: v.id("operaciones"),
    propietarioId: v.id("propietarios"),
    vehiculoId: v.id("vehiculos"),
    conductorId: v.id("conductores"),
    despachadorId: v.id("usuariosSistema"),
    telegramUserId: v.string(),
  }),
  handler: async (ctx) => {
    const hoy = new Date().toISOString().slice(0, 10);
    const enUnAno = new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10);

    const clienteId = await ctx.db.insert("clientes", {
      nombre: "Textiles del Norte S.A.S.",
      tipo: "empresa",
      nit: "900123456-7",
      contactoPrincipal: "Laura Gómez",
      telefono: "+57 300 111 2233",
      email: "operaciones@textilesdelnorte.co",
      direccion: "Cra 50 # 30-15",
      ciudad: "Medellín",
      estado: "activo",
    });
    const programaId = await ctx.db.insert("programasMovilidad", {
      clienteId,
      tipoServicio: "recurrente",
      nombre: "Ruta laboral planta norte",
      descripcion: "Transporte diario de personal a la planta",
      fechaInicio: hoy,
      estado: "activo",
      modalidadPago: "prepago",
      requiereReportePeriodico: true,
    });
    const operacionId = await ctx.db.insert("operaciones", {
      programaId,
      nombre: "Operación planta norte",
      tipoOperacion: "recurrente",
      ciudadBase: "Medellín",
      fechaInicio: hoy,
      estado: "enCurso",
      nivelControl: "controlado",
      requiereCentroControl: false,
    });

    const propietarioId = await ctx.db.insert("propietarios", {
      nombre: "Carlos Restrepo",
      cedulaONit: "71456789",
      tipoPersona: "natural",
      telefono: "+57 310 555 8899",
      estado: "activo",
      cuentaPago: "Bancolombia ahorros 1234567890",
    });
    const vehiculoId = await ctx.db.insert("vehiculos", {
      placa: "WXY123",
      propietarioId,
      tipoVehiculo: "van",
      marca: "Renault",
      linea: "Master",
      modelo: 2023,
      capacidadPasajeros: 15,
      estado: "habilitado",
      gpsActivo: true,
      fechaIngreso: hoy,
    });
    await ctx.db.insert("vinculacionesPropietarioVehiculo", {
      propietarioId,
      vehiculoId,
      fechaDesde: hoy,
      estado: "activa",
    });

    const conductorId = await ctx.db.insert("conductores", {
      nombre: "Andrés Zapata",
      cedula: "1035678901",
      telefono: "+57 301 444 5566",
      licenciaNumero: "1035678901",
      licenciaCategoria: "C2",
      licenciaVence: enUnAno,
      estado: "activo",
      fechaIngreso: hoy,
    });
    await ctx.db.insert("habilitacionesConductorVehiculo", {
      conductorId,
      vehiculoId,
      fechaDesde: hoy,
      estado: "habilitado",
    });
    await ctx.db.insert("documentosCumplimiento", {
      entidadTipo: "vehiculo",
      vehiculoId,
      tipoDocumento: "soat",
      fechaVencimiento: enUnAno,
      estado: "vigente",
    });
    await ctx.db.insert("documentosCumplimiento", {
      entidadTipo: "conductor",
      conductorId,
      tipoDocumento: "licencia",
      fechaVencimiento: enUnAno,
      estado: "vigente",
    });

    const despachadorId = await ctx.db.insert("usuariosSistema", {
      nombre: "Despachador Demo",
      email: "despacho@augemovilidad.co",
      tipoUsuario: "operadorLogistico",
      estado: "activo",
      creadoEn: Date.now(),
    });

    const telegramUserId = "tg-demo-1001";
    await ctx.db.insert("telegramCuentas", {
      conductorId,
      telegramUserId,
      telegramChatId: "chat-demo-1001",
      username: "andres_zapata",
      estado: "vinculada",
      fechaVinculacion: Date.now(),
    });

    return {
      clienteId,
      programaId,
      operacionId,
      propietarioId,
      vehiculoId,
      conductorId,
      despachadorId,
      telegramUserId,
    };
  },
});
