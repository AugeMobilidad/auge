import { useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { Modal, Boton, Etiqueta, Select, Input, ErrorLinea } from "./ui";
import { useAcciones } from "@/auth/acciones";
import { hoyBogota } from "@/lib/formato";

type Vehiculo = { vehiculoId: Id<"vehiculos">; placa: string; tipoVehiculo: string };

const TIPOS_MTTO = ["preventivo", "correctivo", "inspeccion"] as const;

export function MantenimientoModal({
  vehiculos,
  vehiculoInicial,
  onCerrar,
}: {
  vehiculos: Vehiculo[];
  vehiculoInicial?: Id<"vehiculos">;
  onCerrar: () => void;
}) {
  const acciones = useAcciones();
  const [vehiculoId, setVehiculoId] = useState<string>(vehiculoInicial ?? "");
  const [tipo, setTipo] = useState<(typeof TIPOS_MTTO)[number]>("preventivo");
  const [fecha, setFecha] = useState(hoyBogota());
  const [proveedor, setProveedor] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [poner, setPoner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setError(null);
    setEnviando(true);
    try {
      await acciones.programarMantenimiento({
        vehiculoId: vehiculoId as Id<"vehiculos">,
        tipo,
        fechaProgramada: fecha,
        proveedor: proveedor.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
        ponerVehiculoEnMantenimiento: poner,
      });
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      eyebrow="Flota"
      titulo="Programar mantenimiento"
      onCerrar={onCerrar}
      footer={
        <>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            onClick={enviar}
            disabled={vehiculoId === "" || enviando}
          >
            {enviando ? "Enviando…" : "Programar"}
          </Boton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Etiqueta>Vehículo</Etiqueta>
          <Select value={vehiculoId} onChange={(e) => setVehiculoId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {vehiculos.map((v) => (
              <option key={v.vehiculoId} value={v.vehiculoId}>
                {v.placa} · {v.tipoVehiculo}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Etiqueta>Tipo</Etiqueta>
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
              {TIPOS_MTTO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Etiqueta>Fecha programada</Etiqueta>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>
        <div>
          <Etiqueta>Proveedor (opcional)</Etiqueta>
          <Input value={proveedor} onChange={(e) => setProveedor(e.target.value)} />
        </div>
        <div>
          <Etiqueta>Observaciones (opcional)</Etiqueta>
          <Input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-muted">
          <input
            type="checkbox"
            checked={poner}
            onChange={(e) => setPoner(e.target.checked)}
            className="h-4 w-4 accent-[#007e84]"
          />
          Poner el vehículo en mantenimiento ahora
        </label>
        <ErrorLinea mensaje={error} />
      </div>
    </Modal>
  );
}

const ESTADOS_DOC = ["vigente", "porVencer", "vencido", "rechazado"] as const;

export function ActualizarDocModal({
  documentoId,
  estadoActual,
  descripcion,
  onCerrar,
}: {
  documentoId: Id<"documentosCumplimiento">;
  estadoActual: string;
  descripcion: string;
  onCerrar: () => void;
}) {
  const acciones = useAcciones();
  const [estado, setEstado] = useState<(typeof ESTADOS_DOC)[number]>(
    (ESTADOS_DOC as readonly string[]).includes(estadoActual)
      ? (estadoActual as (typeof ESTADOS_DOC)[number])
      : "vigente",
  );
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setError(null);
    setEnviando(true);
    try {
      await acciones.actualizarDocumento({ documentoId, estado });
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      eyebrow="Cumplimiento"
      titulo="Actualizar documento"
      onCerrar={onCerrar}
      footer={
        <>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton variante="primario" onClick={enviar} disabled={enviando}>
            {enviando ? "Enviando…" : "Actualizar"}
          </Boton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="font-mono text-[12px] text-muted">{descripcion}</div>
        <div>
          <Etiqueta>Nuevo estado</Etiqueta>
          <Select value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)}>
            {ESTADOS_DOC.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <ErrorLinea mensaje={error} />
      </div>
    </Modal>
  );
}
