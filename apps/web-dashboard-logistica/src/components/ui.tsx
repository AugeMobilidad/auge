/** Primitivos de UI cohesivos para el panel de control. */
import {
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

type Tono = "neutro" | "ok" | "warn" | "crit" | "info" | "signal";

const TONO_CLASE: Record<Tono, string> = {
  neutro: "text-muted bg-panel-750/60 ring-line",
  ok: "text-ok bg-ok/10 ring-ok/25",
  warn: "text-warn bg-warn/10 ring-warn/25",
  crit: "text-crit bg-crit/10 ring-crit/30",
  info: "text-info bg-info/10 ring-info/25",
  signal: "text-signal bg-signal/10 ring-signal/30",
};

export function Badge({
  children,
  tono = "neutro",
  punto = false,
  pulso = false,
}: {
  children: ReactNode;
  tono?: Tono;
  punto?: boolean;
  pulso?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wider ring-1 ring-inset ${TONO_CLASE[tono]}`}
    >
      {punto && (
        <span
          className={`h-1.5 w-1.5 rounded-full bg-current ${pulso ? "pulso" : ""}`}
        />
      )}
      {children}
    </span>
  );
}

const ESTADO_SERVICIO: Record<string, { tono: Tono; pulso?: boolean }> = {
  programado: { tono: "neutro" },
  asignado: { tono: "info" },
  enPreparacion: { tono: "signal" },
  enCurso: { tono: "ok", pulso: true },
  completado: { tono: "ok" },
  cancelado: { tono: "neutro" },
  fallido: { tono: "crit" },
};

const ETIQUETA_ESTADO: Record<string, string> = {
  programado: "Programado",
  asignado: "Asignado",
  enPreparacion: "En preparación",
  enCurso: "En curso",
  completado: "Completado",
  cancelado: "Cancelado",
  fallido: "Fallido",
};

export function EstadoServicioBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_SERVICIO[estado] ?? { tono: "neutro" as Tono };
  return (
    <Badge tono={cfg.tono} punto pulso={cfg.pulso}>
      {ETIQUETA_ESTADO[estado] ?? estado}
    </Badge>
  );
}

const SEVERIDAD: Record<string, Tono> = {
  baja: "neutro",
  media: "info",
  alta: "warn",
  critica: "crit",
};

export function SeveridadBadge({ severidad }: { severidad: string }) {
  return (
    <Badge tono={SEVERIDAD[severidad] ?? "neutro"} punto>
      {severidad}
    </Badge>
  );
}

const DOC_ESTADO: Record<string, Tono> = {
  vigente: "ok",
  porVencer: "warn",
  vencido: "crit",
  rechazado: "crit",
};

export function DocumentoEstadoBadge({ estado }: { estado: string }) {
  return <Badge tono={DOC_ESTADO[estado] ?? "neutro"}>{estado}</Badge>;
}

export function PrioridadBadge({ prioridad }: { prioridad: string }) {
  if (prioridad === "normal") return null;
  return (
    <Badge tono={prioridad === "critica" ? "crit" : "warn"} punto>
      {prioridad}
    </Badge>
  );
}

// --------------------------------------------------------------------------

type BotonVar = "primario" | "sutil" | "fantasma" | "peligro";
const BOTON_VAR: Record<BotonVar, string> = {
  primario:
    "bg-signal text-signal-ink hover:bg-signal/90 font-semibold shadow-[0_1px_0_rgba(255,255,255,0.15)_inset]",
  sutil: "bg-panel-750 text-fg hover:bg-line ring-1 ring-inset ring-line",
  fantasma: "text-muted hover:text-fg hover:bg-panel-750/70",
  peligro: "bg-crit/15 text-crit hover:bg-crit/25 ring-1 ring-inset ring-crit/30",
};

export function Boton({
  variante = "sutil",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: BotonVar }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${BOTON_VAR[variante]} ${className}`}
      {...props}
    />
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}

export function TituloSeccion({
  eyebrow,
  titulo,
  accion,
}: {
  eyebrow?: string;
  titulo: string;
  accion?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h2 className="font-display text-lg font-bold tracking-tight text-fg">{titulo}</h2>
      </div>
      {accion}
    </div>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line px-6 py-10 text-center text-sm text-faint">
      <span className="font-mono text-[11px] uppercase tracking-widest text-faint">
        sin registros
      </span>
      <span className="text-muted">{children}</span>
    </div>
  );
}

export function Cargando({ filas = 3 }: { filas?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: filas }).map((_, i) => (
        <div
          key={i}
          className="h-11 animate-pulse rounded-lg bg-panel-750/50"
          style={{ animationDelay: `${i * 90}ms` }}
        />
      ))}
    </div>
  );
}

export function Etiqueta({ children }: { children: ReactNode }) {
  return <label className="eyebrow mb-1.5 block">{children}</label>;
}

const CAMPO_BASE =
  "w-full rounded-lg border border-line bg-base-950/60 px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-signal focus:outline-none";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={CAMPO_BASE} {...props} />;
}

export function Select({
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${CAMPO_BASE} appearance-none`} {...props}>
      {children}
    </select>
  );
}

export function Modal({
  titulo,
  eyebrow,
  onCerrar,
  children,
  footer,
}: {
  titulo: string;
  eyebrow?: string;
  onCerrar: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCerrar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-base-950/70 p-4 backdrop-blur-sm"
      onClick={onCerrar}
    >
      <div
        className="panel surgir w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
            <h3 className="font-display text-base font-bold tracking-tight">{titulo}</h3>
          </div>
          <button
            onClick={onCerrar}
            className="rounded-md p-1 text-faint transition-colors hover:bg-panel-750 hover:text-fg"
            aria-label="Cerrar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line bg-base-950/40 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ErrorLinea({ mensaje }: { mensaje: string | null }) {
  if (mensaje === null) return null;
  return (
    <div className="rounded-lg border border-crit/30 bg-crit/10 px-3 py-2 text-[13px] text-crit">
      {mensaje}
    </div>
  );
}
