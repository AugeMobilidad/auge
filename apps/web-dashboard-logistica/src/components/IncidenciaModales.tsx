import { useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { Modal, Boton, Etiqueta, Select, Input, ErrorLinea } from "./ui";
import { useAcciones } from "@/auth/acciones";

const TIPOS = [
  "retraso",
  "noShow",
  "fallaVehiculo",
  "cambioRuta",
  "accidente",
  "queja",
  "contingencia",
  "otro",
] as const;
const SEVERIDADES = ["baja", "media", "alta", "critica"] as const;

export function RegistrarIncidenciaModal({
  servicioId,
  onCerrar,
}: {
  servicioId: Id<"serviciosTransporte">;
  onCerrar: () => void;
}) {
  const acciones = useAcciones();
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>("retraso");
  const [severidad, setSeveridad] = useState<(typeof SEVERIDADES)[number]>("media");
  const [descripcion, setDescripcion] = useState("");
  const [responsable, setResponsable] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setError(null);
    setEnviando(true);
    try {
      await acciones.registrarIncidencia({
        servicioId,
        tipo,
        severidad,
        descripcion: descripcion.trim(),
        responsable: responsable.trim() || undefined,
      });
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al registrar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      eyebrow="Nueva incidencia"
      titulo="Registrar incidencia"
      onCerrar={onCerrar}
      footer={
        <>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            onClick={enviar}
            disabled={descripcion.trim() === "" || enviando}
          >
            {enviando ? "Enviando…" : "Registrar"}
          </Boton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Etiqueta>Tipo</Etiqueta>
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Etiqueta>Severidad</Etiqueta>
            <Select
              value={severidad}
              onChange={(e) => setSeveridad(e.target.value as typeof severidad)}
            >
              {SEVERIDADES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Etiqueta>Descripción</Etiqueta>
          <Input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Qué ocurrió"
          />
        </div>
        <div>
          <Etiqueta>Responsable (opcional)</Etiqueta>
          <Input value={responsable} onChange={(e) => setResponsable(e.target.value)} />
        </div>
        <ErrorLinea mensaje={error} />
      </div>
    </Modal>
  );
}

export function ResolverIncidenciaModal({
  incidenciaId,
  onCerrar,
}: {
  incidenciaId: Id<"incidencias">;
  onCerrar: () => void;
}) {
  const acciones = useAcciones();
  const [accion, setAccion] = useState("");
  const [responsable, setResponsable] = useState("");
  const [cerrar, setCerrar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setError(null);
    setEnviando(true);
    try {
      await acciones.resolverIncidencia({
        incidenciaId,
        accionCorrectiva: accion.trim(),
        responsable: responsable.trim() || undefined,
        cerrar,
      });
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al resolver");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      eyebrow="Gestión"
      titulo="Resolver incidencia"
      onCerrar={onCerrar}
      footer={
        <>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            onClick={enviar}
            disabled={accion.trim() === "" || enviando}
          >
            {enviando ? "Enviando…" : cerrar ? "Resolver y cerrar" : "Resolver"}
          </Boton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Etiqueta>Acción correctiva</Etiqueta>
          <Input
            value={accion}
            onChange={(e) => setAccion(e.target.value)}
            placeholder="Qué se hizo para resolver"
          />
        </div>
        <div>
          <Etiqueta>Responsable (opcional)</Etiqueta>
          <Input value={responsable} onChange={(e) => setResponsable(e.target.value)} />
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-muted">
          <input
            type="checkbox"
            checked={cerrar}
            onChange={(e) => setCerrar(e.target.checked)}
            className="h-4 w-4 accent-[#007e84]"
          />
          Cerrar la incidencia (no solo marcar resuelta)
        </label>
        <ErrorLinea mensaje={error} />
      </div>
    </Modal>
  );
}
