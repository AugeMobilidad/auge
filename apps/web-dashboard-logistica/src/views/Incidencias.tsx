import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Panel, Cargando, Vacio, Boton, Badge, SeveridadBadge } from "@/components/ui";
import { ResolverIncidenciaModal } from "@/components/IncidenciaModales";
import { useNavegar } from "@/lib/rutas";
import { usePermiso } from "@/auth/session";
import { fmtFecha, fmtRelativo } from "@/lib/formato";

export function Incidencias() {
  const incidencias = useQuery(api.appDashboard.dashboardIncidenciasAbiertas, {});
  const navegar = useNavegar();
  const puede = usePermiso("gestionarIncidencias");
  const [resolver, setResolver] = useState<Id<"incidencias"> | null>(null);

  if (incidencias === undefined) return <Cargando filas={6} />;

  const criticas = incidencias.filter((i) => i.severidad === "critica").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tono={incidencias.length > 0 ? "warn" : "ok"}>
          {incidencias.length} abierta(s)
        </Badge>
        {criticas > 0 && <Badge tono="crit" punto pulso>{criticas} crítica(s)</Badge>}
        {!puede && <Badge tono="neutro">Solo lectura — sin permiso de incidencias</Badge>}
      </div>

      <Panel className="overflow-hidden">
        {incidencias.length === 0 ? (
          <div className="p-6">
            <Vacio>No hay incidencias abiertas. Operación sin novedades.</Vacio>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {incidencias.map((i) => (
              <div
                key={i.incidenciaId}
                className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-panel-800/40"
              >
                <div className="w-24 shrink-0 pt-0.5">
                  <SeveridadBadge severidad={i.severidad} />
                </div>
                <div
                  className="min-w-0 flex-1 cursor-pointer"
                  onClick={() => navegar({ vista: "servicio", id: i.servicioId })}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-signal">
                      {i.tipo}
                    </span>
                    <Badge tono={i.estado === "enGestion" ? "info" : "warn"}>{i.estado}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-fg">{i.descripcion}</div>
                  <div className="mt-1 truncate font-mono text-[11px] text-muted">
                    {i.clienteNombre} · {i.rutaTexto}
                    {i.responsable && ` · resp. ${i.responsable}`}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-[11px] text-muted">{fmtRelativo(i.timestamp)}</div>
                  {i.servicioFecha && (
                    <div className="text-[11px] capitalize text-faint">
                      {fmtFecha(i.servicioFecha)}
                    </div>
                  )}
                  {puede && (
                    <Boton
                      variante="primario"
                      className="mt-2 opacity-0 group-hover:opacity-100"
                      onClick={() => setResolver(i.incidenciaId)}
                    >
                      Resolver
                    </Boton>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {resolver !== null && (
        <ResolverIncidenciaModal incidenciaId={resolver} onCerrar={() => setResolver(null)} />
      )}
    </div>
  );
}
