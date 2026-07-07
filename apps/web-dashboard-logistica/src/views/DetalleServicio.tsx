import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  Panel,
  Cargando,
  Boton,
  Badge,
  EstadoServicioBadge,
  PrioridadBadge,
  TituloSeccion,
  Vacio,
  ErrorLinea,
} from "@/components/ui";
import { AsignarModal } from "@/components/AsignarModal";
import { CancelarModal } from "@/components/CancelarModal";
import { RegistrarIncidenciaModal } from "@/components/IncidenciaModales";
import { useNavegar } from "@/lib/rutas";
import { usePermiso } from "@/auth/session";
import { useAcciones } from "@/auth/acciones";
import { IconVolver } from "@/components/iconos";
import { fmtFecha, fmtFechaHoraTs, fmtHoraTs, fmtCOP, fmtRelativo } from "@/lib/formato";

const CHECKLIST_TONO: Record<string, "ok" | "warn" | "crit"> = {
  aprobado: "ok",
  aprobadoConObservaciones: "warn",
  rechazado: "crit",
};

function Dato({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line-soft py-2 last:border-0">
      <span className="text-[12px] text-muted">{k}</span>
      <span className="text-right text-[13px] font-medium text-fg">{v}</span>
    </div>
  );
}

export function DetalleServicio({ servicioId }: { servicioId: Id<"serviciosTransporte"> }) {
  const d = useQuery(api.appDashboard.dashboardDetalleServicio, { servicioId });
  const navegar = useNavegar();
  const puedeDespachar = usePermiso("despachar");
  const puedeIncidencias = usePermiso("gestionarIncidencias");
  const puedeLiquidar = usePermiso("aprobarLiquidaciones");
  const acciones = useAcciones();

  // Listas para reasignar (mismas que la fila de despacho de esa fecha).
  const tablero = useQuery(
    api.appDashboard.dashboardTableroDespacho,
    d ? { fecha: d.servicio.fechaProgramada } : "skip",
  );

  const [reasignar, setReasignar] = useState(false);
  const [cancelar, setCancelar] = useState(false);
  const [incidencia, setIncidencia] = useState(false);
  const [accionError, setAccionError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  if (d === undefined) return <Cargando filas={6} />;
  if (d === null)
    return (
      <div className="space-y-4">
        <Boton variante="fantasma" onClick={() => navegar({ vista: "despacho" })}>
          <IconVolver width={16} height={16} /> Volver
        </Boton>
        <Vacio>El servicio no existe o fue eliminado.</Vacio>
      </div>
    );

  const s = d.servicio;

  async function accionSegura(fn: () => Promise<unknown>) {
    setAccionError(null);
    setOcupado(true);
    try {
      await fn();
    } catch (e) {
      setAccionError(e instanceof Error ? e.message : "Error");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Boton variante="fantasma" onClick={() => navegar({ vista: "despacho" })}>
          <IconVolver width={16} height={16} /> Volver a despacho
        </Boton>
      </div>

      {/* Cabecera del servicio */}
      <Panel className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <EstadoServicioBadge estado={s.estado} />
              <PrioridadBadge prioridad={s.prioridad} />
              {d.rutaNombre && <Badge tono="info">{d.rutaNombre}</Badge>}
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight">
              {s.origenTexto} <span className="text-faint">→</span> {s.destinoTexto}
            </h2>
            <div className="mt-1 font-mono text-[12px] text-muted">
              {s.clienteNombre} · {s.operacionNombre}
            </div>
          </div>
          <div className="text-right">
            <div className="tabular font-display text-3xl font-extrabold text-signal">
              {s.horaInicioProgramada}
            </div>
            <div className="text-[12px] capitalize text-muted">{fmtFecha(s.fechaProgramada)}</div>
            {d.tarifaAcordada !== undefined && (
              <div className="mt-1 font-mono text-[12px] text-fg">{fmtCOP(d.tarifaAcordada)}</div>
            )}
          </div>
        </div>
        <ErrorLinea mensaje={accionError} />
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Asignación */}
        <Panel className="p-5">
          <TituloSeccion eyebrow="Recurso asignado" titulo="Asignación" />
          <div className="mt-3">
            {d.asignacion === null ? (
              <Vacio>Sin asignación activa.</Vacio>
            ) : (
              <>
                <Dato
                  k="Vehículo"
                  v={<span className="font-mono text-signal">{d.asignacion.vehiculoPlaca}</span>}
                />
                <Dato k="Conductor" v={d.asignacion.conductorNombre} />
                <Dato
                  k="Teléfono"
                  v={<span className="font-mono">{d.asignacion.conductorTelefono || "—"}</span>}
                />
                {d.asignacion.gestorNombre && <Dato k="Gestor" v={d.asignacion.gestorNombre} />}
                <Dato k="Estado" v={<Badge tono="info">{d.asignacion.estado}</Badge>} />
              </>
            )}
          </div>
          {puedeDespachar && (
            <div className="mt-4 flex flex-wrap gap-2">
              {d.asignacion?.estado === "propuesta" && (
                <Boton
                  variante="primario"
                  disabled={ocupado}
                  onClick={() =>
                    accionSegura(() =>
                      acciones.confirmarAsignacion({ asignacionId: d.asignacion!.asignacionId }),
                    )
                  }
                >
                  Confirmar asignación
                </Boton>
              )}
              {d.asignacion !== null && s.estado !== "completado" && (
                <Boton variante="sutil" onClick={() => setReasignar(true)}>
                  Reasignar
                </Boton>
              )}
              {s.estado !== "completado" &&
                s.estado !== "cancelado" &&
                s.estado !== "fallido" && (
                  <Boton variante="peligro" onClick={() => setCancelar(true)}>
                    Cancelar / fallido
                  </Boton>
                )}
            </div>
          )}
        </Panel>

        {/* Checklist + Liquidación */}
        <div className="space-y-6">
          <Panel className="p-5">
            <TituloSeccion eyebrow="Preoperativo" titulo="Checklist" />
            <div className="mt-3">
              {d.checklist === null ? (
                <Vacio>Sin checklist aprobado.</Vacio>
              ) : (
                <div className="flex items-center justify-between">
                  <Badge tono={CHECKLIST_TONO[d.checklist.resultado] ?? "neutro"} punto>
                    {d.checklist.resultado}
                  </Badge>
                  <span className="font-mono text-[12px] text-muted">
                    {fmtFechaHoraTs(d.checklist.fecha)}
                  </span>
                </div>
              )}
            </div>
          </Panel>

          <Panel className="p-5">
            <TituloSeccion eyebrow="Financiero" titulo="Liquidación" />
            <div className="mt-3">
              {d.liquidacion === null ? (
                <Vacio>Sin liquidación registrada.</Vacio>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <Badge
                      tono={
                        d.liquidacion.estado === "pagada"
                          ? "ok"
                          : d.liquidacion.estado === "retenida"
                            ? "crit"
                            : "info"
                      }
                    >
                      {d.liquidacion.estado}
                    </Badge>
                    <span className="tabular font-mono text-sm font-medium text-fg">
                      {fmtCOP(d.liquidacion.valorNeto)}
                    </span>
                  </div>
                  {puedeLiquidar && d.liquidacion.estado === "pendiente" && (
                    <Boton
                      variante="primario"
                      className="mt-4 w-full"
                      disabled={ocupado}
                      onClick={() =>
                        accionSegura(() =>
                          acciones.aprobarLiquidacion({
                            liquidacionId: d.liquidacion!.liquidacionId,
                          }),
                        )
                      }
                    >
                      Aprobar liquidación
                    </Boton>
                  )}
                </>
              )}
            </div>
          </Panel>
        </div>

        {/* Trazabilidad GPS */}
        <Panel className="p-5">
          <TituloSeccion
            eyebrow="Trazabilidad"
            titulo="GPS"
            accion={
              d.gpsResumen.ultimoTimestamp !== undefined ? (
                <span className="font-mono text-[12px] text-muted">
                  último {fmtRelativo(d.gpsResumen.ultimoTimestamp)}
                </span>
              ) : undefined
            }
          />
          <div className="mt-3 flex items-baseline gap-2">
            <span className="tabular font-display text-3xl font-extrabold text-fg">
              {d.gpsResumen.puntos}
            </span>
            <span className="text-[12px] text-muted">
              punto(s){d.gpsResumen.puntosTruncados ? " (tope de lectura)" : ""}
            </span>
          </div>
          {d.gpsResumen.hitos.length > 0 && (
            <ul className="mt-4 space-y-2 border-l border-line pl-4">
              {d.gpsResumen.hitos.map((h, i) => (
                <li key={i} className="relative text-[13px]">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-signal" />
                  <span className="font-medium text-fg">{h.evento}</span>
                  <span className="ml-2 font-mono text-[11px] text-muted">
                    {fmtHoraTs(h.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Evidencias + Incidencias */}
        <Panel className="p-5">
          <TituloSeccion eyebrow="Soporte" titulo="Evidencias e incidencias" />
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-line bg-base-950/40 p-4">
              <div className="eyebrow mb-2">Evidencias</div>
              <div className="tabular font-display text-3xl font-extrabold text-fg">
                {d.evidencias}
                {d.evidenciasTruncadas && <span className="text-base text-muted">+</span>}
              </div>
            </div>
            <div className="rounded-xl border border-line bg-base-950/40 p-4">
              <div className="eyebrow mb-2">Incidencias abiertas</div>
              <div
                className={`tabular font-display text-3xl font-extrabold ${
                  d.incidenciasAbiertas > 0 ? "text-crit" : "text-fg"
                }`}
              >
                {d.incidenciasAbiertas}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {puedeIncidencias && (
              <Boton variante="sutil" onClick={() => setIncidencia(true)}>
                Registrar incidencia
              </Boton>
            )}
            {d.incidenciasAbiertas > 0 && (
              <Boton variante="fantasma" onClick={() => navegar({ vista: "incidencias" })}>
                Ver cola de incidencias
              </Boton>
            )}
          </div>
        </Panel>
      </div>

      {reasignar && tablero !== undefined && (
        <AsignarModal
          modo="reasignar"
          servicioId={servicioId}
          conductores={tablero.conductoresAsignables}
          vehiculos={tablero.vehiculosAsignables}
          onCerrar={() => setReasignar(false)}
        />
      )}
      {cancelar && <CancelarModal servicioId={servicioId} onCerrar={() => setCancelar(false)} />}
      {incidencia && (
        <RegistrarIncidenciaModal servicioId={servicioId} onCerrar={() => setIncidencia(false)} />
      )}
    </div>
  );
}
