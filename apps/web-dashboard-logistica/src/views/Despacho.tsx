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
  EstadoServicioBadge,
  PrioridadBadge,
} from "@/components/ui";
import { AsignarModal } from "@/components/AsignarModal";
import { CancelarModal } from "@/components/CancelarModal";
import { useNavegar } from "@/lib/rutas";
import { usePermiso } from "@/auth/session";
import { hoyBogota, fmtFecha } from "@/lib/formato";

export function Despacho() {
  const [fecha, setFecha] = useState(hoyBogota());
  const tablero = useQuery(api.appDashboard.dashboardTableroDespacho, { fecha });
  const navegar = useNavegar();
  const puedeDespachar = usePermiso("despachar");

  const [asignar, setAsignar] = useState<Id<"serviciosTransporte"> | null>(null);
  const [reasignar, setReasignar] = useState<Id<"serviciosTransporte"> | null>(null);
  const [cancelar, setCancelar] = useState<Id<"serviciosTransporte"> | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="eyebrow">Fecha de operación</span>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value || hoyBogota())}
            className="rounded-lg border border-line bg-base-950/60 px-3 py-1.5 font-mono text-[13px] text-fg focus:border-signal focus:outline-none"
          />
          <span className="text-sm capitalize text-muted">{fmtFecha(fecha)}</span>
        </div>
        {!puedeDespachar && (
          <Badge tono="warn">Sin permiso de despacho — solo lectura</Badge>
        )}
      </div>

      {tablero === undefined ? (
        <Cargando filas={6} />
      ) : (
        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
          {/* Fila de despacho */}
          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="font-display text-base font-bold tracking-tight">
                Fila de despacho
              </h2>
              <Badge tono={tablero.serviciosPendientes.length > 0 ? "signal" : "neutro"}>
                {tablero.serviciosPendientes.length} pendiente(s)
              </Badge>
            </div>
            <div className="divide-y divide-line">
              {tablero.serviciosPendientes.length === 0 ? (
                <div className="p-5">
                  <Vacio>No hay servicios programados sin asignar para esta fecha.</Vacio>
                </div>
              ) : (
                tablero.serviciosPendientes.map((s) => (
                  <div
                    key={s.servicioId}
                    className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-panel-800/40"
                  >
                    <div
                      className="tabular w-12 shrink-0 cursor-pointer font-mono text-sm text-fg"
                      onClick={() => navegar({ vista: "servicio", id: s.servicioId })}
                    >
                      {s.horaInicioProgramada}
                    </div>
                    <div
                      className="min-w-0 flex-1 cursor-pointer"
                      onClick={() => navegar({ vista: "servicio", id: s.servicioId })}
                    >
                      <div className="truncate text-sm font-medium text-fg">
                        {s.origenTexto} <span className="text-faint">→</span> {s.destinoTexto}
                      </div>
                      <div className="truncate font-mono text-[11px] text-muted">
                        {s.clienteNombre} · {s.operacionNombre} · {s.tipoVehiculoRequerido}
                      </div>
                      {s.alertas.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <PrioridadBadge prioridad={s.prioridad} />
                          {s.alertas
                            .filter((a) => !a.startsWith("prioridad"))
                            .map((a) => (
                              <Badge key={a} tono="warn">
                                {a}
                              </Badge>
                            ))}
                        </div>
                      )}
                    </div>
                    {puedeDespachar && (
                      <Boton
                        variante="primario"
                        className="opacity-0 group-hover:opacity-100"
                        onClick={() => setAsignar(s.servicioId)}
                      >
                        Asignar
                      </Boton>
                    )}
                  </div>
                ))
              )}
            </div>
          </Panel>

          {/* En operación */}
          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="font-display text-base font-bold tracking-tight">En operación</h2>
              <Badge tono={tablero.asignacionesDelDia.length > 0 ? "ok" : "neutro"}>
                {tablero.asignacionesDelDia.length} asignación(es)
              </Badge>
            </div>
            <div className="divide-y divide-line">
              {tablero.asignacionesDelDia.length === 0 ? (
                <div className="p-5">
                  <Vacio>Aún no hay servicios asignados en operación hoy.</Vacio>
                </div>
              ) : (
                tablero.asignacionesDelDia.map((a) => (
                  <div
                    key={a.asignacionId}
                    className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-panel-800/40"
                  >
                    <div
                      className="tabular w-12 shrink-0 cursor-pointer font-mono text-sm text-fg"
                      onClick={() => navegar({ vista: "servicio", id: a.servicioId })}
                    >
                      {a.horaInicioProgramada}
                    </div>
                    <div
                      className="min-w-0 flex-1 cursor-pointer"
                      onClick={() => navegar({ vista: "servicio", id: a.servicioId })}
                    >
                      <div className="truncate text-sm font-medium text-fg">{a.rutaTexto}</div>
                      <div className="truncate font-mono text-[11px] text-muted">
                        <span className="text-signal">{a.vehiculoPlaca}</span> · {a.conductorNombre}
                      </div>
                    </div>
                    <EstadoServicioBadge estado={a.estado} />
                    {puedeDespachar && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                        <Boton variante="sutil" onClick={() => setReasignar(a.servicioId)}>
                          Reasignar
                        </Boton>
                        <Boton variante="peligro" onClick={() => setCancelar(a.servicioId)}>
                          Cancelar
                        </Boton>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      )}

      {asignar !== null && tablero !== undefined && (
        <AsignarModal
          modo="asignar"
          servicioId={asignar}
          conductores={tablero.conductoresAsignables}
          vehiculos={tablero.vehiculosAsignables}
          onCerrar={() => setAsignar(null)}
        />
      )}
      {reasignar !== null && tablero !== undefined && (
        <AsignarModal
          modo="reasignar"
          servicioId={reasignar}
          conductores={tablero.conductoresAsignables}
          vehiculos={tablero.vehiculosAsignables}
          onCerrar={() => setReasignar(null)}
        />
      )}
      {cancelar !== null && (
        <CancelarModal servicioId={cancelar} onCerrar={() => setCancelar(null)} />
      )}
    </div>
  );
}
