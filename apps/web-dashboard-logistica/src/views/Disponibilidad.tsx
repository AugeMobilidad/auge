import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  Panel,
  Cargando,
  Vacio,
  Boton,
  Badge,
  DocumentoEstadoBadge,
  TituloSeccion,
} from "@/components/ui";
import { MantenimientoModal, ActualizarDocModal } from "@/components/GestionModales";
import { usePermiso } from "@/auth/session";
import { hoyBogota, fmtFecha } from "@/lib/formato";

type DocSel = {
  documentoId: Id<"documentosCumplimiento">;
  estado: string;
  descripcion: string;
};

function ListaBloqueados({
  titulo,
  filas,
}: {
  titulo: string;
  filas: Array<{ nombre: string; motivo: string }>;
}) {
  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className="font-display text-base font-bold tracking-tight">{titulo}</h2>
        <Badge tono={filas.length > 0 ? "crit" : "ok"}>{filas.length}</Badge>
      </div>
      {filas.length === 0 ? (
        <div className="p-5">
          <Vacio>Ninguno bloqueado.</Vacio>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {filas.map((f, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-5 py-3">
              <span className="truncate text-sm font-medium text-fg">{f.nombre}</span>
              <span className="shrink-0 font-mono text-[11px] text-crit">{f.motivo}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function Disponibilidad() {
  const cumplimiento = useQuery(api.appDashboard.dashboardCumplimiento, {});
  const documentos = useQuery(api.appDashboard.dashboardDocumentosProximosVencer, {});
  const tablero = useQuery(api.appDashboard.dashboardTableroDespacho, { fecha: hoyBogota() });
  const puedeDocs = usePermiso("gestionarDocumentos");

  const [mtto, setMtto] = useState(false);
  const [doc, setDoc] = useState<DocSel | null>(null);

  if (cumplimiento === undefined || documentos === undefined) return <Cargando filas={6} />;

  const vehiculos = tablero?.vehiculosAsignables ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3">
          <div className="panel px-4 py-2.5">
            <span className="eyebrow">Documentos vencidos</span>
            <div
              className={`tabular font-display text-2xl font-extrabold ${
                cumplimiento.documentosVencidos > 0 ? "text-crit" : "text-fg"
              }`}
            >
              {cumplimiento.documentosVencidos}
            </div>
          </div>
          <div className="panel px-4 py-2.5">
            <span className="eyebrow">Por vencer (30 d)</span>
            <div
              className={`tabular font-display text-2xl font-extrabold ${
                cumplimiento.documentosPorVencer30Dias > 0 ? "text-signal" : "text-fg"
              }`}
            >
              {cumplimiento.documentosPorVencer30Dias}
            </div>
          </div>
        </div>
        {puedeDocs && (
          <Boton variante="primario" onClick={() => setMtto(true)}>
            Programar mantenimiento
          </Boton>
        )}
      </div>

      {/* Documentos próximos a vencer / vencidos */}
      <Panel className="overflow-hidden">
        <div className="border-b border-line px-5 py-3.5">
          <TituloSeccion eyebrow="Cumplimiento documental" titulo="Documentos por vencer y vencidos" />
        </div>
        {documentos.length === 0 ? (
          <div className="p-5">
            <Vacio>Sin documentos próximos a vencer.</Vacio>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {documentos.map((d) => (
              <div key={d.documentoId} className="group flex items-center gap-4 px-5 py-3">
                <div className="w-24 shrink-0">
                  <DocumentoEstadoBadge estado={d.estado} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-fg">
                    {d.entidadNombre}{" "}
                    <span className="font-mono text-[11px] text-muted">
                      {d.identificacion}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-muted">
                    {d.entidadTipo} · {d.tipoDocumento}
                    {d.fechaVencimiento && ` · vence ${fmtFecha(d.fechaVencimiento)}`}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {d.diasRestantes !== null && (
                    <span
                      className={`tabular font-mono text-[12px] ${
                        d.diasRestantes < 0
                          ? "text-crit"
                          : d.diasRestantes <= 7
                            ? "text-signal"
                            : "text-muted"
                      }`}
                    >
                      {d.diasRestantes < 0
                        ? `${Math.abs(d.diasRestantes)} d vencido`
                        : `${d.diasRestantes} d`}
                    </span>
                  )}
                </div>
                {puedeDocs && (
                  <Boton
                    variante="sutil"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() =>
                      setDoc({
                        documentoId: d.documentoId,
                        estado: d.estado,
                        descripcion: `${d.tipoDocumento} · ${d.entidadNombre} (${d.identificacion})`,
                      })
                    }
                  >
                    Actualizar
                  </Boton>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ListaBloqueados titulo="Conductores bloqueados" filas={cumplimiento.conductoresBloqueados} />
        <ListaBloqueados
          titulo="Vehículos bloqueados"
          filas={cumplimiento.vehiculosBloqueados.map((v) => ({
            nombre: v.placa,
            motivo: v.motivo,
          }))}
        />
      </div>

      {/* Mantenimientos pendientes */}
      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="font-display text-base font-bold tracking-tight">
            Mantenimientos pendientes
          </h2>
          <Badge tono={cumplimiento.mantenimientosPendientes.length > 0 ? "warn" : "ok"}>
            {cumplimiento.mantenimientosPendientes.length}
          </Badge>
        </div>
        {cumplimiento.mantenimientosPendientes.length === 0 ? (
          <div className="p-5">
            <Vacio>No hay mantenimientos pendientes.</Vacio>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {cumplimiento.mantenimientosPendientes.map((m) => (
              <li
                key={m.mantenimientoId}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <span className="font-mono text-sm text-signal">{m.vehiculoPlaca}</span>
                <span className="flex-1 text-[13px] text-muted">{m.tipo}</span>
                <span className="font-mono text-[12px] capitalize text-muted">
                  {fmtFecha(m.fechaProgramada)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {mtto && <MantenimientoModal vehiculos={vehiculos} onCerrar={() => setMtto(false)} />}
      {doc !== null && (
        <ActualizarDocModal
          documentoId={doc.documentoId}
          estadoActual={doc.estado}
          descripcion={doc.descripcion}
          onCerrar={() => setDoc(null)}
        />
      )}
    </div>
  );
}
