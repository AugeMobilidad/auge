import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Panel, Cargando, Vacio, Boton, Badge } from "@/components/ui";
import { TelegramVerificarModal } from "@/components/TelegramVerificarModal";
import { usePermiso } from "@/auth/session";
import { fmtRelativo } from "@/lib/formato";

export function VerificacionTelegram() {
  const pendientes = useQuery(api.appDashboard.dashboardTelegramPendientes, {});
  const candidatos = useQuery(api.appDashboard.dashboardTelegramCandidatos, {});
  const puede = usePermiso("administrar");
  const [cuentaId, setCuentaId] = useState<Id<"telegramCuentas"> | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  if (pendientes === undefined) return <Cargando filas={6} />;

  const cuenta = pendientes.find((p) => p.cuentaId === cuentaId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tono={pendientes.length > 0 ? "warn" : "ok"}>
          {pendientes.length} pendiente(s)
        </Badge>
        {!puede && <Badge tono="neutro">Solo lectura - sin permiso de administración</Badge>}
        {exito && <Badge tono="ok">{exito}</Badge>}
      </div>

      <Panel className="overflow-hidden">
        {pendientes.length === 0 ? (
          <div className="p-6">
            <Vacio>No hay cuentas de Telegram pendientes de verificación.</Vacio>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {pendientes.map((p) => (
              <div
                key={p.cuentaId}
                className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-panel-800/40"
              >
                <div className="w-28 shrink-0 pt-0.5">
                  <Badge tono="info" punto>
                    Telegram
                  </Badge>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-signal">
                      {p.username ? `@${p.username}` : "sin username"}
                    </span>
                    {p.telefono && <Badge tono="neutro">{p.telefono}</Badge>}
                  </div>
                  <div className="mt-1 text-sm text-fg">
                    Solicitud de vinculación pendiente
                  </div>
                  <div className="mt-1 truncate font-mono text-[11px] text-muted">
                    user {p.telegramUserId} · chat {p.telegramChatId}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-[11px] text-muted">
                    {p.solicitadaEn ? fmtRelativo(p.solicitadaEn) : "sin fecha"}
                  </div>
                  {puede && (
                    <Boton
                      variante="primario"
                      className="mt-2 opacity-0 group-hover:opacity-100"
                      onClick={() => {
                        setExito(null);
                        setCuentaId(p.cuentaId);
                      }}
                    >
                      Verificar
                    </Boton>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {cuenta !== null && (
        <TelegramVerificarModal
          cuenta={cuenta}
          candidatos={candidatos}
          onCerrar={() => setCuentaId(null)}
          onExito={() => setExito("Cuenta vinculada")}
        />
      )}
    </div>
  );
}
