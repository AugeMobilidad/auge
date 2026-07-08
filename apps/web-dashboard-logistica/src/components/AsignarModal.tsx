import { useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { Modal, Boton, Etiqueta, Select, Input, ErrorLinea } from "./ui";
import { useAcciones } from "@/auth/acciones";

type Conductor = { conductorId: Id<"conductores">; nombre: string; telefono: string };
type Vehiculo = {
  vehiculoId: Id<"vehiculos">;
  placa: string;
  tipoVehiculo: string;
  capacidadPasajeros: number;
};

export function AsignarModal({
  modo,
  servicioId,
  conductores,
  vehiculos,
  onCerrar,
}: {
  modo: "asignar" | "reasignar";
  servicioId: Id<"serviciosTransporte">;
  conductores: Conductor[];
  vehiculos: Vehiculo[];
  onCerrar: () => void;
}) {
  const acciones = useAcciones();
  const [conductorId, setConductorId] = useState<string>("");
  const [vehiculoId, setVehiculoId] = useState<string>("");
  const [motivo, setMotivo] = useState("");
  const [confirmar, setConfirmar] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const puede =
    conductorId !== "" && vehiculoId !== "" && (modo === "asignar" || motivo.trim() !== "");

  async function enviar() {
    setError(null);
    setEnviando(true);
    try {
      const base = {
        servicioId,
        vehiculoId: vehiculoId as Id<"vehiculos">,
        conductorId: conductorId as Id<"conductores">,
        confirmarInmediato: confirmar,
      };
      if (modo === "asignar") await acciones.asignarServicio(base);
      else await acciones.reasignarServicio({ ...base, motivoReemplazo: motivo.trim() });
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al asignar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      eyebrow={modo === "asignar" ? "Despacho" : "Reasignación"}
      titulo={modo === "asignar" ? "Asignar vehículo y conductor" : "Reemplazar asignación"}
      onCerrar={onCerrar}
      footer={
        <>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton variante="primario" onClick={enviar} disabled={!puede || enviando}>
            {enviando ? "Enviando…" : modo === "asignar" ? "Asignar" : "Reasignar"}
          </Boton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Etiqueta>Conductor</Etiqueta>
          <Select value={conductorId} onChange={(e) => setConductorId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {conductores.map((c) => (
              <option key={c.conductorId} value={c.conductorId}>
                {c.nombre} · {c.telefono}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Etiqueta>Vehículo</Etiqueta>
          <Select value={vehiculoId} onChange={(e) => setVehiculoId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {vehiculos.map((v) => (
              <option key={v.vehiculoId} value={v.vehiculoId}>
                {v.placa} · {v.tipoVehiculo} · {v.capacidadPasajeros} pax
              </option>
            ))}
          </Select>
        </div>
        {modo === "reasignar" && (
          <div>
            <Etiqueta>Motivo del reemplazo</Etiqueta>
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. falla mecánica del vehículo asignado"
            />
          </div>
        )}
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-muted">
          <input
            type="checkbox"
            checked={confirmar}
            onChange={(e) => setConfirmar(e.target.checked)}
            className="h-4 w-4 accent-[#007e84]"
          />
          Confirmar inmediatamente (pasa el servicio a <span className="text-fg">asignado</span>)
        </label>
        <ErrorLinea mensaje={error} />
      </div>
    </Modal>
  );
}
