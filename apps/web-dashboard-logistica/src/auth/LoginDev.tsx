import { useSesion } from "./session";
import { Cargando } from "@/components/ui";

const ETIQUETA_TIPO: Record<string, string> = {
  operadorLogistico: "Operador logístico",
  coordinador: "Coordinador",
  admin: "Administrador",
  sistema: "Sistema",
  conductor: "Conductor",
  propietario: "Propietario",
  gestor: "Gestor",
  cliente: "Cliente",
};

/** Puerta de login de desarrollo: selector de actor (swap-ready a Clerk). */
export function LoginDev() {
  const { cargando, usuarios, iniciarSesion } = useSesion();

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-signal text-signal-ink">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 18 L10 6 L14 6 L20 18" />
              <path d="M8 14h8" />
            </svg>
          </div>
          <div>
            <div className="font-display text-2xl font-extrabold tracking-tight">
              Auge · Control de Operaciones
            </div>
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
              Acceso de desarrollo
            </div>
          </div>
        </div>

        <div className="panel p-5">
          <div className="eyebrow mb-3">Ingresar como</div>

          {cargando ? (
            <Cargando filas={4} />
          ) : usuarios.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
              No hay usuarios del sistema activos.
              <div className="mt-2 font-mono text-[12px] text-faint">
                Ejecuta las semillas: <br />
                <span className="text-signal">bunx convex run dev/semillas:sembrarDatosDemo</span>
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {usuarios.map((u) => (
                <li key={u.id}>
                  <button
                    onClick={() => iniciarSesion(u.id)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-line bg-panel-850/60 px-3.5 py-3 text-left transition-colors hover:border-signal/40 hover:bg-panel-800"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-panel-750 font-display text-sm font-bold text-signal">
                      {u.nombre
                        .split(" ")
                        .slice(0, 2)
                        .map((p) => p[0])
                        .join("")
                        .toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{u.nombre}</span>
                      <span className="block font-mono text-[11px] text-muted">
                        {ETIQUETA_TIPO[u.tipoUsuario] ?? u.tipoUsuario}
                        {u.permisos.length > 0 && ` · ${u.permisos.length} permiso(s)`}
                      </span>
                    </span>
                    <svg
                      className="text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-signal"
                      width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-4 text-center font-mono text-[11px] leading-relaxed text-faint">
          Login de desarrollo. En producción se reemplaza por Clerk y el actor se
          deriva del servidor. Ver README de la app.
        </p>
      </div>
    </div>
  );
}
