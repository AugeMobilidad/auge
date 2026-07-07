import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Panel, Cargando, TituloSeccion } from "@/components/ui";
import { useNavegar } from "@/lib/rutas";
import { fmtNumero } from "@/lib/formato";

function Tile({
  valor,
  etiqueta,
  sub,
  tono = "fg",
  onClick,
}: {
  valor: number | string;
  etiqueta: string;
  sub?: string;
  tono?: "fg" | "signal" | "ok" | "crit" | "info";
  onClick?: () => void;
}) {
  const color = {
    fg: "text-fg",
    signal: "text-signal",
    ok: "text-ok",
    crit: "text-crit",
    info: "text-info",
  }[tono];
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`panel group flex flex-col justify-between gap-4 p-5 text-left transition-transform ${
        onClick ? "hover:-translate-y-0.5 hover:border-signal/30" : "cursor-default"
      }`}
    >
      <div className="eyebrow">{etiqueta}</div>
      <div>
        <div className={`tabular font-display text-4xl font-extrabold leading-none ${color}`}>
          {typeof valor === "number" ? fmtNumero(valor) : valor}
        </div>
        {sub && <div className="mt-1.5 font-mono text-[11px] text-muted">{sub}</div>}
      </div>
    </button>
  );
}

const SEGMENTOS: Array<{ clave: string; etiqueta: string; color: string }> = [
  { clave: "programado", etiqueta: "Programado", color: "#5c6678" },
  { clave: "asignado", etiqueta: "Asignado", color: "#56b6e6" },
  { clave: "enPreparacion", etiqueta: "Preparación", color: "#f5a524" },
  { clave: "enCurso", etiqueta: "En curso", color: "#35d39a" },
  { clave: "completado", etiqueta: "Completado", color: "#2f8f6c" },
  { clave: "cancelado", etiqueta: "Cancelado", color: "#3a4353" },
  { clave: "fallido", etiqueta: "Fallido", color: "#fb7185" },
];

export function Resumen() {
  const r = useQuery(api.appDashboard.dashboardResumenOperativo, {});
  const navegar = useNavegar();

  if (r === undefined) return <Cargando filas={5} />;

  const porEstado = r.serviciosPorEstado as Record<string, number>;
  const total = SEGMENTOS.reduce((s, seg) => s + (porEstado[seg.clave] ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Tile
          valor={r.pendientesAsignacion}
          etiqueta="Pendientes de asignar"
          tono="signal"
          sub="requieren despacho"
          onClick={() => navegar({ vista: "despacho" })}
        />
        <Tile valor={r.serviciosActivos} etiqueta="Servicios activos" tono="ok" sub="en preparación / curso" />
        <Tile
          valor={r.incidenciasAbiertas}
          etiqueta="Incidencias abiertas"
          tono={r.incidenciasCriticas > 0 ? "crit" : "fg"}
          sub={`${r.incidenciasCriticas} crítica(s)`}
          onClick={() => navegar({ vista: "incidencias" })}
        />
        <Tile valor={r.vehiculosHabilitados} etiqueta="Vehículos habilitados" tono="info" />
        <Tile valor={r.conductoresActivos} etiqueta="Conductores activos" tono="info" />
        <Tile
          valor={r.documentosPorVencer30Dias}
          etiqueta="Docs. por vencer"
          tono={r.documentosPorVencer30Dias > 0 ? "signal" : "fg"}
          sub="próximos 30 días"
          onClick={() => navegar({ vista: "disponibilidad" })}
        />
      </div>

      <Panel className="p-6">
        <TituloSeccion eyebrow="Hoy" titulo="Distribución de servicios" />
        <div className="mt-5">
          {total === 0 ? (
            <div className="py-4 font-mono text-[12px] text-faint">
              Sin servicios registrados para hoy.
            </div>
          ) : (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full ring-1 ring-inset ring-line">
                {SEGMENTOS.map((seg) => {
                  const n = porEstado[seg.clave] ?? 0;
                  if (n === 0) return null;
                  return (
                    <div
                      key={seg.clave}
                      style={{ width: `${(n / total) * 100}%`, backgroundColor: seg.color }}
                      title={`${seg.etiqueta}: ${n}`}
                    />
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                {SEGMENTOS.map((seg) => {
                  const n = porEstado[seg.clave] ?? 0;
                  return (
                    <div key={seg.clave} className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="text-[13px] text-muted">{seg.etiqueta}</span>
                      <span className="tabular font-mono text-[13px] font-medium text-fg">{n}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}
