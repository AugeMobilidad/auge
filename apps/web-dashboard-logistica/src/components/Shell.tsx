import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRuta, useNavegar, type VistaPrincipal } from "@/lib/rutas";
import { useSesion } from "@/auth/session";
import { fmtFechaLarga, hoyBogota } from "@/lib/formato";
import {
  IconResumen,
  IconDespacho,
  IconIncidencias,
  IconDisponibilidad,
  IconControl,
  IconSalir,
} from "./iconos";

type ItemNav = {
  vista: VistaPrincipal;
  etiqueta: string;
  Icono: (p: { className?: string }) => ReactNode;
};

const ITEMS: ItemNav[] = [
  { vista: "resumen", etiqueta: "Resumen", Icono: IconResumen },
  { vista: "despacho", etiqueta: "Despacho", Icono: IconDespacho },
  { vista: "incidencias", etiqueta: "Incidencias", Icono: IconIncidencias },
  { vista: "disponibilidad", etiqueta: "Disponibilidad", Icono: IconDisponibilidad },
  { vista: "control", etiqueta: "Control operacional", Icono: IconControl },
];

const TITULOS: Record<string, { eyebrow: string; titulo: string }> = {
  resumen: { eyebrow: "Panorama del día", titulo: "Resumen operativo" },
  despacho: { eyebrow: "Fila de despacho", titulo: "Despacho del día" },
  servicio: { eyebrow: "Trazabilidad", titulo: "Detalle de servicio" },
  incidencias: { eyebrow: "Cola de gestión", titulo: "Incidencias abiertas" },
  disponibilidad: { eyebrow: "Flota y cumplimiento", titulo: "Disponibilidad" },
  control: { eyebrow: "Señales de calidad", titulo: "Control operacional" },
};

function Marca() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-signal text-signal-ink">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 18 L10 6 L14 6 L20 18" />
          <path d="M8 14h8" />
        </svg>
      </div>
      <div className="leading-none">
        <div className="font-display text-[15px] font-extrabold tracking-tight">AUGE</div>
        <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-faint">
          Operaciones
        </div>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const ruta = useRuta();
  const navegar = useNavegar();
  const { actor, cerrarSesion } = useSesion();
  const resumen = useQuery(api.appDashboard.dashboardResumenOperativo, {});

  const activa: string = ruta.vista;
  const cabecera = TITULOS[activa] ?? TITULOS.resumen;

  const contadores: Partial<Record<VistaPrincipal, number>> = {
    despacho: resumen?.pendientesAsignacion,
    incidencias: resumen?.incidenciasAbiertas,
  };

  return (
    <div className="flex min-h-screen">
      {/* Riel de navegación */}
      <aside className="sticky top-0 flex h-screen w-[236px] shrink-0 flex-col gap-6 border-r border-line bg-base-900/70 px-4 py-5 backdrop-blur">
        <Marca />
        <nav className="flex flex-1 flex-col gap-1">
          {ITEMS.map(({ vista, etiqueta, Icono }) => {
            const activo =
              activa === vista || (vista === "despacho" && activa === "servicio");
            const conteo = contadores[vista];
            return (
              <button
                key={vista}
                onClick={() => navegar({ vista })}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors ${
                  activo
                    ? "bg-panel-800 text-fg ring-1 ring-inset ring-line"
                    : "text-muted hover:bg-panel-800/50 hover:text-fg"
                }`}
              >
                <span
                  className={`transition-colors ${activo ? "text-signal" : "text-faint group-hover:text-muted"}`}
                >
                  <Icono />
                </span>
                <span className="flex-1 text-left">{etiqueta}</span>
                {conteo !== undefined && conteo > 0 && (
                  <span
                    className={`tabular rounded-md px-1.5 py-0.5 font-mono text-[10.5px] ${
                      vista === "incidencias"
                        ? "bg-crit/15 text-crit"
                        : "bg-signal/15 text-signal"
                    }`}
                  >
                    {conteo}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {actor && (
          <div className="rounded-xl border border-line bg-panel-850/60 p-3">
            <div className="eyebrow mb-1">Sesión (dev)</div>
            <div className="truncate text-sm font-medium">{actor.nombre}</div>
            <div className="mb-2 font-mono text-[11px] text-muted">{actor.tipoUsuario}</div>
            <button
              onClick={cerrarSesion}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line py-1.5 text-[12px] text-muted transition-colors hover:border-crit/40 hover:text-crit"
            >
              <IconSalir width={14} height={14} />
              Cambiar de usuario
            </button>
          </div>
        )}
      </aside>

      {/* Área principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-line bg-base-950/80 px-8 py-4 backdrop-blur">
          <div>
            <div className="eyebrow mb-0.5">{cabecera.eyebrow}</div>
            <h1 className="font-display text-xl font-bold tracking-tight">{cabecera.titulo}</h1>
          </div>
          <div className="flex items-center gap-2 text-right">
            <div className="hidden sm:block">
              <div className="flex items-center justify-end gap-1.5 font-mono text-[11px] text-ok">
                <span className="pulso h-1.5 w-1.5 rounded-full bg-ok" />
                EN LÍNEA
              </div>
              <div className="text-xs capitalize text-muted">{fmtFechaLarga(hoyBogota())}</div>
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-8 py-7">{children}</main>
      </div>
    </div>
  );
}
