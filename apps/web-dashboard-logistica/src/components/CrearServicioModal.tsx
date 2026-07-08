import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Modal, Boton, Etiqueta, Select, Input, ErrorLinea } from "./ui";
import { useAcciones } from "@/auth/acciones";
import { useNavegar } from "@/lib/rutas";
import { hoyBogota } from "@/lib/formato";

const TIPOS_VEHICULO = [
  "automovil",
  "van",
  "buseta",
  "bus",
  "camioneta",
  "otro",
] as const;

const PRIORIDADES = ["normal", "alta", "critica"] as const;

type TipoVehiculo = (typeof TIPOS_VEHICULO)[number];
type Prioridad = (typeof PRIORIDADES)[number];

function numeroOpcional(valor: string): number | undefined {
  if (valor.trim() === "") return undefined;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : undefined;
}

export function CrearServicioModal({
  fechaInicial,
  onCerrar,
}: {
  fechaInicial?: string;
  onCerrar: () => void;
}) {
  const acciones = useAcciones();
  const navegar = useNavegar();
  const operaciones = useQuery(api.appDashboard.dashboardOperacionesActivas, {});
  const rutas = useQuery(api.appDashboard.dashboardRutasActivas, {});
  const solicitudes = useQuery(api.appDashboard.dashboardSolicitudesDisponibles, {});

  const [operacionId, setOperacionId] = useState<string>("");
  const [solicitudId, setSolicitudId] = useState<string>("");
  const [rutaId, setRutaId] = useState<string>("");
  const [fechaProgramada, setFechaProgramada] = useState(fechaInicial || hoyBogota());
  const [horaInicioProgramada, setHoraInicioProgramada] = useState("");
  const [horaFinProgramada, setHoraFinProgramada] = useState("");
  const [origenTexto, setOrigenTexto] = useState("");
  const [destinoTexto, setDestinoTexto] = useState("");
  const [cantidadPasajerosProgramada, setCantidadPasajerosProgramada] = useState("");
  const [tipoVehiculoRequerido, setTipoVehiculoRequerido] =
    useState<TipoVehiculo>("automovil");
  const [prioridad, setPrioridad] = useState<Prioridad>("normal");
  const [tarifaAcordada, setTarifaAcordada] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const puede =
    operacionId !== "" &&
    fechaProgramada !== "" &&
    horaInicioProgramada !== "" &&
    origenTexto.trim() !== "" &&
    destinoTexto.trim() !== "";

  async function enviar() {
    setError(null);
    setEnviando(true);
    try {
      const nuevoServicioId = await acciones.crearServicio({
        operacionId: operacionId as Id<"operaciones">,
        solicitudId:
          solicitudId === "" ? undefined : (solicitudId as Id<"solicitudesServicio">),
        rutaId: rutaId === "" ? undefined : (rutaId as Id<"rutas">),
        fechaProgramada,
        horaInicioProgramada,
        horaFinProgramada: horaFinProgramada.trim() || undefined,
        origenTexto: origenTexto.trim(),
        destinoTexto: destinoTexto.trim(),
        cantidadPasajerosProgramada: numeroOpcional(cantidadPasajerosProgramada),
        tipoVehiculoRequerido,
        prioridad,
        tarifaAcordada: numeroOpcional(tarifaAcordada),
        observaciones: observaciones.trim() || undefined,
      });
      onCerrar();
      navegar({ vista: "servicio", id: nuevoServicioId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear el servicio");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      eyebrow="Despacho"
      titulo="Crear servicio"
      onCerrar={onCerrar}
      footer={
        <>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton variante="primario" onClick={enviar} disabled={!puede || enviando}>
            {enviando ? "Creando…" : "Crear servicio"}
          </Boton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Etiqueta>Operación</Etiqueta>
          <Select value={operacionId} onChange={(e) => setOperacionId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {(operaciones ?? []).map((o) => (
              <option key={o.operacionId} value={o.operacionId}>
                {o.nombre} · {o.tipoOperacion} · {o.estado}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Etiqueta>Solicitud (opcional)</Etiqueta>
          <Select value={solicitudId} onChange={(e) => setSolicitudId(e.target.value)}>
            <option value="">Sin solicitud asociada</option>
            {(solicitudes ?? []).map((s) => (
              <option key={s.solicitudId} value={s.solicitudId}>
                {s.clienteNombre} · {s.origenTexto} → {s.destinoTexto}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Etiqueta>Ruta (opcional)</Etiqueta>
          <Select value={rutaId} onChange={(e) => setRutaId(e.target.value)}>
            <option value="">Sin ruta asociada</option>
            {(rutas ?? []).map((r) => (
              <option key={r.rutaId} value={r.rutaId}>
                {r.nombre} · {r.origenPrincipal} → {r.destinoPrincipal}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Etiqueta>Fecha</Etiqueta>
            <Input
              type="date"
              value={fechaProgramada}
              onChange={(e) => setFechaProgramada(e.target.value)}
            />
          </div>
          <div>
            <Etiqueta>Hora inicio</Etiqueta>
            <Input
              type="time"
              value={horaInicioProgramada}
              onChange={(e) => setHoraInicioProgramada(e.target.value)}
            />
          </div>
          <div>
            <Etiqueta>Hora fin</Etiqueta>
            <Input
              type="time"
              value={horaFinProgramada}
              onChange={(e) => setHoraFinProgramada(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Etiqueta>Origen</Etiqueta>
            <Input
              value={origenTexto}
              onChange={(e) => setOrigenTexto(e.target.value)}
              placeholder="Dirección o punto de salida"
            />
          </div>
          <div>
            <Etiqueta>Destino</Etiqueta>
            <Input
              value={destinoTexto}
              onChange={(e) => setDestinoTexto(e.target.value)}
              placeholder="Dirección o punto de llegada"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Etiqueta>Vehículo</Etiqueta>
            <Select
              value={tipoVehiculoRequerido}
              onChange={(e) => setTipoVehiculoRequerido(e.target.value as TipoVehiculo)}
            >
              {TIPOS_VEHICULO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Etiqueta>Prioridad</Etiqueta>
            <Select
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value as Prioridad)}
            >
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Etiqueta>Pasajeros</Etiqueta>
            <Input
              type="number"
              min={1}
              value={cantidadPasajerosProgramada}
              onChange={(e) => setCantidadPasajerosProgramada(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Etiqueta>Tarifa COP (opcional)</Etiqueta>
            <Input
              type="number"
              min={0}
              value={tarifaAcordada}
              onChange={(e) => setTarifaAcordada(e.target.value)}
            />
          </div>
          <div>
            <Etiqueta>Observaciones (opcional)</Etiqueta>
            <Input
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>
        </div>

        <ErrorLinea mensaje={error} />
      </div>
    </Modal>
  );
}
