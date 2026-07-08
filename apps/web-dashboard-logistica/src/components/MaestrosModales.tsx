import { useState, type ReactNode } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { useAcciones } from "@/auth/acciones";
import { hoyBogota } from "@/lib/formato";
import { Modal, Boton, Etiqueta, Input, Select, ErrorLinea } from "./ui";

export type ClienteMaestro = {
  clienteId: Id<"clientes">;
  nombre: string;
  tipo: string;
  estado: string;
  ciudad: string;
  contactoPrincipal: string;
  telefono: string;
  email: string;
  nit?: string;
  direccion: string;
  notas?: string;
};

export type ProgramaMaestro = {
  programaId: Id<"programasMovilidad">;
  nombre: string;
  clienteId: Id<"clientes">;
  clienteNombre: string;
  tipoServicio: string;
  estado: string;
  fechaInicio: string;
  fechaFin?: string;
  modalidadPago: string;
  descripcion: string;
  requiereReportePeriodico: boolean;
  reglasOperativas?: string;
};

export type OperacionMaestra = {
  operacionId: Id<"operaciones">;
  nombre: string;
  programaId: Id<"programasMovilidad">;
  programaNombre: string;
  clienteNombre: string;
  tipoOperacion: string;
  estado: string;
  fechaInicio: string;
  fechaFin?: string;
  nivelControl: string;
  ciudadBase?: string;
  zonaOperacion?: string;
  responsableOperativo?: string;
  requiereCentroControl: boolean;
};

export type RutaMaestra = {
  rutaId: Id<"rutas">;
  nombre: string;
  programaId: Id<"programasMovilidad">;
  programaNombre: string;
  tipoRuta: string;
  origenPrincipal: string;
  destinoPrincipal: string;
  activa: boolean;
  frecuencia: string;
  capacidadObjetivo?: number;
  reglasAbordaje?: string;
};

export type ParadaMaestra = {
  paradaId: Id<"paradas">;
  nombre: string;
  orden: number;
  direccionTexto: string;
  geo?: { lat: number; lng: number };
  ventanaInicio?: string;
  ventanaFin?: string;
  activa: boolean;
};

const TIPOS_CLIENTE = ["empresa", "institucion", "comunidad", "evento", "persona"] as const;
const TIPOS_SERVICIO = ["puntual", "recurrente", "gestorValidado", "evento", "comunidad"] as const;
const ESTADOS_CLIENTE = ["activo", "inactivo"] as const;
const ESTADOS_OPERACION = ["planificada", "enCurso", "pausada", "cerrada", "cancelada"] as const;
const NIVELES_CONTROL = ["basico", "controlado", "comandoOperativo"] as const;
const TIPOS_RUTA = ["laboral", "institucional", "comunidad", "evento", "intermunicipal", "otra"] as const;
const FRECUENCIAS = ["unica", "diaria", "semanal", "personalizada"] as const;
const MODALIDADES = ["prepago", "credito", "mixto"] as const;

function limpio(valor: string): string | undefined {
  const v = valor.trim();
  return v === "" ? undefined : v;
}

function numeroOpcional(valor: string): number | undefined {
  if (valor.trim() === "") return undefined;
  const n = Number(valor);
  return Number.isFinite(n) ? n : undefined;
}

function errorDe(e: unknown): string {
  return e instanceof Error ? e.message : "Error";
}

export function ClienteModal({
  cliente,
  onCerrar,
}: {
  cliente?: ClienteMaestro;
  onCerrar: () => void;
}) {
  const acciones = useAcciones();
  const [nombre, setNombre] = useState(cliente?.nombre ?? "");
  const [tipo, setTipo] = useState<(typeof TIPOS_CLIENTE)[number]>(
    (cliente?.tipo as (typeof TIPOS_CLIENTE)[number] | undefined) ?? "empresa",
  );
  const [estado, setEstado] = useState<(typeof ESTADOS_CLIENTE)[number]>(
    (cliente?.estado as (typeof ESTADOS_CLIENTE)[number] | undefined) ?? "activo",
  );
  const [nit, setNit] = useState(cliente?.nit ?? "");
  const [contacto, setContacto] = useState(cliente?.contactoPrincipal ?? "");
  const [telefono, setTelefono] = useState(cliente?.telefono ?? "");
  const [email, setEmail] = useState(cliente?.email ?? "");
  const [direccion, setDireccion] = useState(cliente?.direccion ?? "");
  const [ciudad, setCiudad] = useState(cliente?.ciudad ?? "");
  const [notas, setNotas] = useState(cliente?.notas ?? "");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setError(null);
    setEnviando(true);
    try {
      const base = {
        nombre: nombre.trim(),
        tipo,
        nit: limpio(nit),
        contactoPrincipal: contacto.trim(),
        telefono: telefono.trim(),
        email: email.trim(),
        direccion: direccion.trim(),
        ciudad: ciudad.trim(),
        notas: limpio(notas),
      };
      if (cliente) {
        await acciones.maestroActualizarCliente({
          clienteId: cliente.clienteId,
          ...base,
          estado,
        });
      } else {
        await acciones.maestroCrearCliente(base);
      }
      onCerrar();
    } catch (e) {
      setError(errorDe(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      eyebrow="Clientes"
      titulo={cliente ? "Editar cliente" : "Nuevo cliente"}
      onCerrar={onCerrar}
      footer={<PieModal onCerrar={onCerrar} enviando={enviando} onEnviar={enviar} />}
    >
      <div className="space-y-4">
        <Campo texto="Nombre"><Input value={nombre} onChange={(e) => setNombre(e.target.value)} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo texto="Tipo"><Select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>{TIPOS_CLIENTE.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Campo>
          {cliente && <Campo texto="Estado"><Select value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)}>{ESTADOS_CLIENTE.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Campo>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo texto="NIT"><Input value={nit} onChange={(e) => setNit(e.target.value)} /></Campo>
          <Campo texto="Ciudad"><Input value={ciudad} onChange={(e) => setCiudad(e.target.value)} /></Campo>
        </div>
        <Campo texto="Contacto"><Input value={contacto} onChange={(e) => setContacto(e.target.value)} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo texto="Teléfono"><Input value={telefono} onChange={(e) => setTelefono(e.target.value)} /></Campo>
          <Campo texto="Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} /></Campo>
        </div>
        <Campo texto="Dirección"><Input value={direccion} onChange={(e) => setDireccion(e.target.value)} /></Campo>
        <Campo texto="Notas"><Input value={notas} onChange={(e) => setNotas(e.target.value)} /></Campo>
        <ErrorLinea mensaje={error} />
      </div>
    </Modal>
  );
}

export function ProgramaModal({
  clientes,
  onCerrar,
}: {
  clientes: ClienteMaestro[];
  onCerrar: () => void;
}) {
  const acciones = useAcciones();
  const [clienteId, setClienteId] = useState<string>("");
  const [nombre, setNombre] = useState("");
  const [tipoServicio, setTipoServicio] = useState<(typeof TIPOS_SERVICIO)[number]>("recurrente");
  const [descripcion, setDescripcion] = useState("");
  const [fechaInicio, setFechaInicio] = useState(hoyBogota());
  const [fechaFin, setFechaFin] = useState("");
  const [modalidadPago, setModalidadPago] = useState<(typeof MODALIDADES)[number]>("credito");
  const [requiereReporte, setRequiereReporte] = useState(false);
  const [reglas, setReglas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setError(null);
    setEnviando(true);
    try {
      await acciones.maestroCrearPrograma({
        clienteId: clienteId as Id<"clientes">,
        nombre: nombre.trim(),
        tipoServicio,
        descripcion: descripcion.trim(),
        fechaInicio,
        fechaFin: limpio(fechaFin),
        modalidadPago,
        requiereReportePeriodico: requiereReporte,
        reglasOperativas: limpio(reglas),
      });
      onCerrar();
    } catch (e) {
      setError(errorDe(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      eyebrow="Programas"
      titulo="Nuevo programa"
      onCerrar={onCerrar}
      footer={<PieModal onCerrar={onCerrar} enviando={enviando} onEnviar={enviar} deshabilitado={clienteId === ""} />}
    >
      <div className="space-y-4">
        <Campo texto="Cliente"><Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}><option value="">Seleccionar...</option>{clientes.filter((c) => c.estado === "activo").map((c) => <option key={c.clienteId} value={c.clienteId}>{c.nombre}</option>)}</Select></Campo>
        <Campo texto="Nombre"><Input value={nombre} onChange={(e) => setNombre(e.target.value)} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo texto="Tipo"><Select value={tipoServicio} onChange={(e) => setTipoServicio(e.target.value as typeof tipoServicio)}>{TIPOS_SERVICIO.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Campo>
          <Campo texto="Pago"><Select value={modalidadPago} onChange={(e) => setModalidadPago(e.target.value as typeof modalidadPago)}>{MODALIDADES.map((m) => <option key={m} value={m}>{m}</option>)}</Select></Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo texto="Inicio"><Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} /></Campo>
          <Campo texto="Fin"><Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} /></Campo>
        </div>
        <Campo texto="Descripción"><Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></Campo>
        <Campo texto="Reglas"><Input value={reglas} onChange={(e) => setReglas(e.target.value)} /></Campo>
        <label className="flex items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" checked={requiereReporte} onChange={(e) => setRequiereReporte(e.target.checked)} className="h-4 w-4 accent-[#f5a524]" />
          Requiere reporte periódico
        </label>
        <ErrorLinea mensaje={error} />
      </div>
    </Modal>
  );
}

export function OperacionModal({
  programas,
  operacion,
  onCerrar,
}: {
  programas: ProgramaMaestro[];
  operacion?: OperacionMaestra;
  onCerrar: () => void;
}) {
  const acciones = useAcciones();
  const [programaId, setProgramaId] = useState<string>(operacion?.programaId ?? "");
  const [nombre, setNombre] = useState(operacion?.nombre ?? "");
  const [tipoOperacion, setTipoOperacion] = useState<(typeof TIPOS_SERVICIO)[number]>(
    (operacion?.tipoOperacion as (typeof TIPOS_SERVICIO)[number] | undefined) ?? "recurrente",
  );
  const [ciudadBase, setCiudadBase] = useState(operacion?.ciudadBase ?? "");
  const [zonaOperacion, setZonaOperacion] = useState(operacion?.zonaOperacion ?? "");
  const [fechaInicio, setFechaInicio] = useState(operacion?.fechaInicio ?? hoyBogota());
  const [fechaFin, setFechaFin] = useState(operacion?.fechaFin ?? "");
  const [estado, setEstado] = useState<(typeof ESTADOS_OPERACION)[number]>(
    (operacion?.estado as (typeof ESTADOS_OPERACION)[number] | undefined) ?? "planificada",
  );
  const [responsable, setResponsable] = useState(operacion?.responsableOperativo ?? "");
  const [nivelControl, setNivelControl] = useState<(typeof NIVELES_CONTROL)[number]>(
    (operacion?.nivelControl as (typeof NIVELES_CONTROL)[number] | undefined) ?? "basico",
  );
  const [centroControl, setCentroControl] = useState(operacion?.requiereCentroControl ?? false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setError(null);
    setEnviando(true);
    try {
      const base = {
        nombre: nombre.trim(),
        tipoOperacion,
        ciudadBase: limpio(ciudadBase),
        zonaOperacion: limpio(zonaOperacion),
        fechaInicio,
        fechaFin: limpio(fechaFin),
        responsableOperativo: limpio(responsable),
        nivelControl,
        requiereCentroControl: centroControl,
      };
      if (operacion) {
        await acciones.maestroActualizarOperacion({
          operacionId: operacion.operacionId,
          ...base,
          estado,
        });
      } else {
        await acciones.maestroCrearOperacion({
          programaId: programaId as Id<"programasMovilidad">,
          ...base,
        });
      }
      onCerrar();
    } catch (e) {
      setError(errorDe(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      eyebrow="Operaciones"
      titulo={operacion ? "Editar operación" : "Nueva operación"}
      onCerrar={onCerrar}
      footer={<PieModal onCerrar={onCerrar} enviando={enviando} onEnviar={enviar} deshabilitado={!operacion && programaId === ""} />}
    >
      <div className="space-y-4">
        {!operacion && <Campo texto="Programa"><Select value={programaId} onChange={(e) => setProgramaId(e.target.value)}><option value="">Seleccionar...</option>{programas.map((p) => <option key={p.programaId} value={p.programaId}>{p.nombre} · {p.clienteNombre}</option>)}</Select></Campo>}
        <Campo texto="Nombre"><Input value={nombre} onChange={(e) => setNombre(e.target.value)} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo texto="Tipo"><Select value={tipoOperacion} onChange={(e) => setTipoOperacion(e.target.value as typeof tipoOperacion)}>{TIPOS_SERVICIO.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Campo>
          <Campo texto="Estado"><Select value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)}>{ESTADOS_OPERACION.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo texto="Inicio"><Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} /></Campo>
          <Campo texto="Fin"><Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} /></Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo texto="Ciudad"><Input value={ciudadBase} onChange={(e) => setCiudadBase(e.target.value)} /></Campo>
          <Campo texto="Zona"><Input value={zonaOperacion} onChange={(e) => setZonaOperacion(e.target.value)} /></Campo>
        </div>
        <Campo texto="Responsable"><Input value={responsable} onChange={(e) => setResponsable(e.target.value)} /></Campo>
        <Campo texto="Nivel"><Select value={nivelControl} onChange={(e) => setNivelControl(e.target.value as typeof nivelControl)}>{NIVELES_CONTROL.map((n) => <option key={n} value={n}>{n}</option>)}</Select></Campo>
        <label className="flex items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" checked={centroControl} onChange={(e) => setCentroControl(e.target.checked)} className="h-4 w-4 accent-[#f5a524]" />
          Requiere centro de control
        </label>
        <ErrorLinea mensaje={error} />
      </div>
    </Modal>
  );
}

export function RutaModal({
  programas,
  ruta,
  onCerrar,
}: {
  programas: ProgramaMaestro[];
  ruta?: RutaMaestra;
  onCerrar: () => void;
}) {
  const acciones = useAcciones();
  const [programaId, setProgramaId] = useState<string>(ruta?.programaId ?? "");
  const [nombre, setNombre] = useState(ruta?.nombre ?? "");
  const [tipoRuta, setTipoRuta] = useState<(typeof TIPOS_RUTA)[number]>(
    (ruta?.tipoRuta as (typeof TIPOS_RUTA)[number] | undefined) ?? "laboral",
  );
  const [origen, setOrigen] = useState(ruta?.origenPrincipal ?? "");
  const [destino, setDestino] = useState(ruta?.destinoPrincipal ?? "");
  const [activa, setActiva] = useState(ruta?.activa ?? true);
  const [frecuencia, setFrecuencia] = useState<(typeof FRECUENCIAS)[number]>(
    (ruta?.frecuencia as (typeof FRECUENCIAS)[number] | undefined) ?? "diaria",
  );
  const [capacidad, setCapacidad] = useState(ruta?.capacidadObjetivo?.toString() ?? "");
  const [reglas, setReglas] = useState(ruta?.reglasAbordaje ?? "");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setError(null);
    setEnviando(true);
    try {
      const base = {
        nombre: nombre.trim(),
        tipoRuta,
        origenPrincipal: origen.trim(),
        destinoPrincipal: destino.trim(),
        frecuencia,
        capacidadObjetivo: numeroOpcional(capacidad),
        reglasAbordaje: limpio(reglas),
      };
      if (ruta) {
        await acciones.maestroActualizarRuta({ rutaId: ruta.rutaId, ...base, activa });
      } else {
        await acciones.maestroCrearRuta({
          programaId: programaId as Id<"programasMovilidad">,
          ...base,
        });
      }
      onCerrar();
    } catch (e) {
      setError(errorDe(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      eyebrow="Rutas"
      titulo={ruta ? "Editar ruta" : "Nueva ruta"}
      onCerrar={onCerrar}
      footer={<PieModal onCerrar={onCerrar} enviando={enviando} onEnviar={enviar} deshabilitado={!ruta && programaId === ""} />}
    >
      <div className="space-y-4">
        {!ruta && <Campo texto="Programa"><Select value={programaId} onChange={(e) => setProgramaId(e.target.value)}><option value="">Seleccionar...</option>{programas.map((p) => <option key={p.programaId} value={p.programaId}>{p.nombre} · {p.clienteNombre}</option>)}</Select></Campo>}
        <Campo texto="Nombre"><Input value={nombre} onChange={(e) => setNombre(e.target.value)} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo texto="Tipo"><Select value={tipoRuta} onChange={(e) => setTipoRuta(e.target.value as typeof tipoRuta)}>{TIPOS_RUTA.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Campo>
          <Campo texto="Frecuencia"><Select value={frecuencia} onChange={(e) => setFrecuencia(e.target.value as typeof frecuencia)}>{FRECUENCIAS.map((f) => <option key={f} value={f}>{f}</option>)}</Select></Campo>
        </div>
        <Campo texto="Origen"><Input value={origen} onChange={(e) => setOrigen(e.target.value)} /></Campo>
        <Campo texto="Destino"><Input value={destino} onChange={(e) => setDestino(e.target.value)} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo texto="Capacidad"><Input type="number" value={capacidad} onChange={(e) => setCapacidad(e.target.value)} /></Campo>
          <label className="mt-6 flex items-center gap-2 text-[13px] text-muted">
            <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} className="h-4 w-4 accent-[#f5a524]" />
            Ruta activa
          </label>
        </div>
        <Campo texto="Reglas"><Input value={reglas} onChange={(e) => setReglas(e.target.value)} /></Campo>
        <ErrorLinea mensaje={error} />
      </div>
    </Modal>
  );
}

export function ParadaModal({
  parada,
  rutaId,
  siguienteOrden,
  onCerrar,
}: {
  parada?: ParadaMaestra;
  rutaId: Id<"rutas">;
  siguienteOrden: number;
  onCerrar: () => void;
}) {
  const acciones = useAcciones();
  const [nombre, setNombre] = useState(parada?.nombre ?? "");
  const [orden, setOrden] = useState((parada?.orden ?? siguienteOrden).toString());
  const [direccion, setDireccion] = useState(parada?.direccionTexto ?? "");
  const [lat, setLat] = useState(parada?.geo?.lat.toString() ?? "");
  const [lng, setLng] = useState(parada?.geo?.lng.toString() ?? "");
  const [ventanaInicio, setVentanaInicio] = useState(parada?.ventanaInicio ?? "");
  const [ventanaFin, setVentanaFin] = useState(parada?.ventanaFin ?? "");
  const [activa, setActiva] = useState(parada?.activa ?? true);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setError(null);
    setEnviando(true);
    try {
      const geo =
        lat.trim() !== "" && lng.trim() !== ""
          ? { lat: Number(lat), lng: Number(lng) }
          : undefined;
      const base = {
        nombre: nombre.trim(),
        orden: Number(orden),
        direccionTexto: direccion.trim(),
        geo,
        ventanaInicio: limpio(ventanaInicio),
        ventanaFin: limpio(ventanaFin),
      };
      if (parada) {
        await acciones.maestroActualizarParada({
          paradaId: parada.paradaId,
          ...base,
          activa,
        });
      } else {
        await acciones.maestroCrearParada({ rutaId, ...base });
      }
      onCerrar();
    } catch (e) {
      setError(errorDe(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      eyebrow="Paradas"
      titulo={parada ? "Editar parada" : "Nueva parada"}
      onCerrar={onCerrar}
      footer={<PieModal onCerrar={onCerrar} enviando={enviando} onEnviar={enviar} />}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[90px_1fr] gap-3">
          <Campo texto="Orden"><Input type="number" value={orden} onChange={(e) => setOrden(e.target.value)} /></Campo>
          <Campo texto="Nombre"><Input value={nombre} onChange={(e) => setNombre(e.target.value)} /></Campo>
        </div>
        <Campo texto="Dirección"><Input value={direccion} onChange={(e) => setDireccion(e.target.value)} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo texto="Latitud"><Input type="number" value={lat} onChange={(e) => setLat(e.target.value)} /></Campo>
          <Campo texto="Longitud"><Input type="number" value={lng} onChange={(e) => setLng(e.target.value)} /></Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo texto="Ventana inicio"><Input type="time" value={ventanaInicio} onChange={(e) => setVentanaInicio(e.target.value)} /></Campo>
          <Campo texto="Ventana fin"><Input type="time" value={ventanaFin} onChange={(e) => setVentanaFin(e.target.value)} /></Campo>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} className="h-4 w-4 accent-[#f5a524]" />
          Parada activa
        </label>
        <ErrorLinea mensaje={error} />
      </div>
    </Modal>
  );
}

function Campo({ texto, children }: { texto: string; children: ReactNode }) {
  return (
    <div>
      <Etiqueta>{texto}</Etiqueta>
      {children}
    </div>
  );
}

function PieModal({
  onCerrar,
  onEnviar,
  enviando,
  deshabilitado = false,
}: {
  onCerrar: () => void;
  onEnviar: () => void;
  enviando: boolean;
  deshabilitado?: boolean;
}) {
  return (
    <>
      <Boton variante="fantasma" onClick={onCerrar}>
        Cancelar
      </Boton>
      <Boton variante="primario" onClick={onEnviar} disabled={enviando || deshabilitado}>
        {enviando ? "Enviando..." : "Guardar"}
      </Boton>
    </>
  );
}
