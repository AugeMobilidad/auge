import { useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { Modal, Boton, Etiqueta, Input, ErrorLinea } from "./ui";
import { useAcciones } from "@/auth/acciones";

export function CancelarModal({
  servicioId,
  onCerrar,
}: {
  servicioId: Id<"serviciosTransporte">;
  onCerrar: () => void;
}) {
  const acciones = useAcciones();
  const [motivo, setMotivo] = useState("");
  const [fallido, setFallido] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setError(null);
    setEnviando(true);
    try {
      await acciones.cancelarServicio({
        servicioId,
        motivo: motivo.trim(),
        marcarFallido: fallido,
      });
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cancelar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      eyebrow="Cierre negativo"
      titulo={fallido ? "Marcar servicio como fallido" : "Cancelar servicio"}
      onCerrar={onCerrar}
      footer={
        <>
          <Boton variante="fantasma" onClick={onCerrar}>
            Volver
          </Boton>
          <Boton
            variante="peligro"
            onClick={enviar}
            disabled={motivo.trim() === "" || enviando}
          >
            {enviando ? "Enviando…" : fallido ? "Marcar fallido" : "Cancelar servicio"}
          </Boton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Etiqueta>Motivo</Etiqueta>
          <Input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Describe el motivo del cierre"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-muted">
          <input
            type="checkbox"
            checked={fallido}
            onChange={(e) => setFallido(e.target.checked)}
            className="h-4 w-4 accent-[#c72c41]"
          />
          Marcar como <span className="text-crit">fallido</span> (hubo asignación activa)
        </label>
        <ErrorLinea mensaje={error} />
      </div>
    </Modal>
  );
}
