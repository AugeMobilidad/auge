import { useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Panel, Cargando, Vacio, Badge, TituloSeccion } from "@/components/ui";
import { useNavegar } from "@/lib/rutas";
import { hoyBogota, sumarDias, fmtCOP } from "@/lib/formato";

// -------- helpers de tabla --------

type Col<T> = {
  h: string;
  celda: (f: T) => ReactNode;
  mono?: boolean;
  ancho?: string;
  fin?: boolean;
};

function Tabla<T>({
  cols,
  filas,
  claveFila,
  onFila,
  vacio,
}: {
  cols: Col<T>[];
  filas: T[];
  claveFila: (f: T, i: number) => string;
  onFila?: (f: T) => void;
  vacio: string;
}) {
  if (filas.length === 0) return <Vacio>{vacio}</Vacio>;
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th
                key={i}
                className={`sticky top-0 border-b border-line bg-panel-850/80 px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-wider text-faint ${
                  c.fin ? "text-right" : "text-left"
                }`}
                style={{ width: c.ancho }}
              >
                {c.h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr
              key={claveFila(f, i)}
              onClick={onFila ? () => onFila(f) : undefined}
              className={`transition-colors ${onFila ? "cursor-pointer hover:bg-panel-800/50" : ""}`}
            >
              {cols.map((c, j) => (
                <td
                  key={j}
                  className={`border-b border-line-soft px-3 py-2.5 align-top ${
                    c.fin ? "text-right" : "text-left"
                  } ${c.mono ? "font-mono text-[12px] tabular" : ""}`}
                >
                  {c.celda(f)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Bloque({
  eyebrow,
  titulo,
  children,
}: {
  eyebrow: string;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <Panel className="p-5">
      <TituloSeccion eyebrow={eyebrow} titulo={titulo} />
      <div className="mt-4">{children}</div>
    </Panel>
  );
}

// -------- pestañas --------

function TabEjecucion({ desde, hasta }: { desde: string; hasta: string }) {
  const navegar = useNavegar();
  const improv = useQuery(api.analisis.riesgoImprovisacion, { desde, hasta });
  const punt = useQuery(api.analisis.puntualidadVerificable, { desde, hasta });
  const rutas = useQuery(api.analisis.rutasConBajaOcupacion, { desde, hasta });

  const resumenPunt =
    punt?.reduce(
      (acc, p) => {
        acc[p.estadoPuntualidad] += 1;
        return acc;
      },
      { puntual: 0, tarde: 0, sinVerificacion: 0 },
    ) ?? null;

  return (
    <div className="space-y-6">
      <Bloque eyebrow="Puntualidad verificable" titulo="Inicio real vs. programado">
        {resumenPunt === null ? (
          <Cargando filas={1} />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ["Puntuales", resumenPunt.puntual, "ok"],
                ["Tarde", resumenPunt.tarde, "crit"],
                ["Sin verificación", resumenPunt.sinVerificacion, "warn"],
              ] as const
            ).map(([k, n, t]) => (
              <div key={k} className="rounded-xl border border-line bg-base-950/40 p-4">
                <div className="eyebrow mb-1.5">{k}</div>
                <div
                  className={`tabular font-display text-3xl font-extrabold ${
                    t === "ok" ? "text-ok" : t === "crit" ? "text-crit" : "text-signal"
                  }`}
                >
                  {n}
                </div>
              </div>
            ))}
          </div>
        )}
      </Bloque>

      <Bloque eyebrow="Riesgo de improvisación" titulo="Servicios creados o asignados tarde">
        {improv === undefined ? (
          <Cargando filas={3} />
        ) : (
          <Tabla
            filas={improv}
            claveFila={(f) => f.servicioId}
            onFila={(f) => navegar({ vista: "servicio", id: f.servicioId })}
            vacio="Sin riesgo de improvisación en el rango."
            cols={[
              { h: "Cliente", celda: (f) => f.clienteNombre },
              { h: "Operación", celda: (f) => f.operacionNombre },
              { h: "Fecha", mono: true, celda: (f) => f.fechaProgramada },
              {
                h: "Min. creación→inicio",
                mono: true,
                fin: true,
                celda: (f) => (
                  <span className={f.minutosCreacionAInicio < 60 ? "text-crit" : "text-muted"}>
                    {f.minutosCreacionAInicio}
                  </span>
                ),
              },
            ]}
          />
        )}
      </Bloque>

      <Bloque eyebrow="Ocupación" titulo="Rutas con baja ocupación">
        {rutas === undefined ? (
          <Cargando filas={3} />
        ) : (
          <Tabla
            filas={rutas}
            claveFila={(f) => f.rutaId}
            vacio="Sin rutas por debajo del umbral."
            cols={[
              { h: "Ruta", celda: (f) => f.rutaNombre },
              { h: "Tipo", mono: true, celda: (f) => f.tipoRuta },
              { h: "Servicios", mono: true, fin: true, celda: (f) => f.totalServicios },
              {
                h: "Ocupación",
                mono: true,
                fin: true,
                celda: (f) => (
                  <span className="text-signal">{f.utilizacionPorcentaje ?? "—"}%</span>
                ),
              },
            ]}
          />
        )}
      </Bloque>
    </div>
  );
}

function TabRecursos({ desde, hasta }: { desde: string; hasta: string }) {
  const conductores = useQuery(api.analisis.conductoresConIncidenciasRecurrentes, { desde, hasta });
  const flota = useQuery(api.analisis.flotaConBajaUtilizacion, { desde, hasta });
  const gestores = useQuery(api.analisis.gestoresConDesempenoDeficiente, {});

  return (
    <div className="space-y-6">
      <Bloque eyebrow="Conductores" titulo="Incidencias recurrentes">
        {conductores === undefined ? (
          <Cargando filas={3} />
        ) : (
          <Tabla
            filas={conductores}
            claveFila={(f) => f.conductorId}
            vacio="Ningún conductor supera el mínimo de incidencias."
            cols={[
              { h: "Conductor", celda: (f) => f.nombre },
              { h: "Total", mono: true, fin: true, celda: (f) => f.totalIncidencias },
              {
                h: "Críticas",
                mono: true,
                fin: true,
                celda: (f) => <span className={f.criticas > 0 ? "text-crit" : ""}>{f.criticas}</span>,
              },
            ]}
          />
        )}
      </Bloque>

      <Bloque eyebrow="Flota" titulo="Vehículos con baja utilización">
        {flota === undefined ? (
          <Cargando filas={3} />
        ) : (
          <Tabla
            filas={flota}
            claveFila={(f) => f.vehiculoId}
            vacio="Toda la flota supera el umbral de utilización."
            cols={[
              { h: "Placa", mono: true, celda: (f) => <span className="text-signal">{f.placa}</span> },
              { h: "Propietario", celda: (f) => f.propietarioNombre },
              { h: "Asignados", mono: true, fin: true, celda: (f) => f.serviciosAsignados },
              { h: "Completados", mono: true, fin: true, celda: (f) => f.serviciosCompletados },
            ]}
          />
        )}
      </Bloque>

      <Bloque eyebrow="Gestores" titulo="Desempeño deficiente">
        {gestores === undefined ? (
          <Cargando filas={3} />
        ) : (
          <Tabla
            filas={gestores}
            claveFila={(f) => f.gestorId}
            vacio="Sin gestores en desempeño deficiente."
            cols={[
              { h: "Gestor", celda: (f) => f.nombre },
              {
                h: "Completado",
                mono: true,
                fin: true,
                celda: (f) => (f.ratioCompletados !== null ? `${f.ratioCompletados}%` : "—"),
              },
              { h: "Reemplazos", mono: true, fin: true, celda: (f) => f.reemplazos },
              { h: "Incidencias", mono: true, fin: true, celda: (f) => f.incidencias },
            ]}
          />
        )}
      </Bloque>
    </div>
  );
}

function TabNegocio({ desde, hasta }: { desde: string; hasta: string }) {
  const clientes = useQuery(api.analisis.clientesConMayorReproceso, { desde, hasta });
  const docs = useQuery(api.analisis.documentosCriticosVencidos, {});

  return (
    <div className="space-y-6">
      <Bloque eyebrow="Clientes" titulo="Mayor reproceso">
        {clientes === undefined ? (
          <Cargando filas={3} />
        ) : (
          <Tabla
            filas={clientes}
            claveFila={(f) => f.clienteId}
            vacio="Sin reproceso significativo por cliente."
            cols={[
              { h: "Cliente", celda: (f) => f.clienteNombre },
              { h: "Servicios", mono: true, fin: true, celda: (f) => f.totalServicios },
              { h: "Cancelados", mono: true, fin: true, celda: (f) => f.cancelados },
              { h: "Incidencias", mono: true, fin: true, celda: (f) => f.incidencias },
              {
                h: "Índice",
                mono: true,
                fin: true,
                celda: (f) => <span className="text-signal">{f.indiceReproceso}%</span>,
              },
            ]}
          />
        )}
      </Bloque>

      <Bloque eyebrow="Cumplimiento" titulo="Documentos críticos vencidos (bloquean operación)">
        {docs === undefined ? (
          <Cargando filas={3} />
        ) : (
          <Tabla
            filas={docs}
            claveFila={(f, i) => `${f.entidadTipo}-${f.identificacion}-${i}`}
            vacio="Sin documentos críticos vencidos que bloqueen operación."
            cols={[
              { h: "Entidad", celda: (f) => f.entidadNombre },
              { h: "Tipo", mono: true, celda: (f) => f.entidadTipo },
              { h: "Ident.", mono: true, celda: (f) => f.identificacion },
              {
                h: "Docs. vencidos",
                fin: true,
                celda: (f) => (
                  <span className="font-mono text-crit">{f.documentosVencidos.length}</span>
                ),
              },
            ]}
          />
        )}
      </Bloque>
    </div>
  );
}

function TabFinanciero() {
  const liq = useQuery(api.appDashboard.dashboardLiquidaciones, {});
  const eventos = useQuery(api.appDashboard.dashboardEventos, {});

  return (
    <div className="space-y-6">
      <Bloque eyebrow="Liquidaciones" titulo="Estado financiero">
        {liq === undefined ? (
          <Cargando filas={2} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {(
                [
                  ["Pendiente", liq.porEstado.pendiente, "signal"],
                  ["Aprobada", liq.porEstado.aprobada, "info"],
                  ["Pagada", liq.porEstado.pagada, "ok"],
                  ["Retenida", liq.porEstado.retenida, "crit"],
                ] as const
              ).map(([k, val, t]) => (
                <div key={k} className="rounded-xl border border-line bg-base-950/40 p-4">
                  <div className="eyebrow mb-1.5">{k}</div>
                  <div
                    className={`tabular font-display text-xl font-extrabold ${
                      t === "ok"
                        ? "text-ok"
                        : t === "crit"
                          ? "text-crit"
                          : t === "info"
                            ? "text-info"
                            : "text-signal"
                    }`}
                  >
                    {fmtCOP(val.total)}
                  </div>
                  <div className="font-mono text-[11px] text-muted">{val.cantidad} liq.</div>
                </div>
              ))}
            </div>
            <div className="mt-5">
              <Tabla
                filas={liq.porBeneficiario}
                claveFila={(f, i) => `${f.beneficiarioTipo}-${f.beneficiarioNombre}-${i}`}
                vacio="Sin liquidaciones por beneficiario."
                cols={[
                  { h: "Beneficiario", celda: (f) => f.beneficiarioNombre },
                  { h: "Tipo", mono: true, celda: (f) => f.beneficiarioTipo },
                  { h: "Liq.", mono: true, fin: true, celda: (f) => f.cantidad },
                  { h: "Neto", mono: true, fin: true, celda: (f) => fmtCOP(f.totalNeto) },
                  {
                    h: "Pend. aprob.",
                    mono: true,
                    fin: true,
                    celda: (f) =>
                      f.pendienteAprobacion > 0 ? (
                        <span className="text-signal">{fmtCOP(f.pendienteAprobacion)}</span>
                      ) : (
                        "—"
                      ),
                  },
                ]}
              />
            </div>
          </>
        )}
      </Bloque>

      <Bloque eyebrow="Centro de comando" titulo="Eventos activos">
        {eventos === undefined ? (
          <Cargando filas={2} />
        ) : (
          <Tabla
            filas={eventos}
            claveFila={(f) => f.eventoId}
            vacio="Sin eventos en planeación, montaje o curso."
            cols={[
              { h: "Evento", celda: (f) => f.nombre },
              { h: "Cliente", celda: (f) => f.clienteNombre },
              {
                h: "Estado",
                celda: (f) => <Badge tono="info">{f.estado}</Badge>,
              },
              { h: "Complejidad", mono: true, celda: (f) => f.nivelComplejidad },
              { h: "En curso", mono: true, fin: true, celda: (f) => f.serviciosEnCurso },
              {
                h: "Crít. abiertas",
                mono: true,
                fin: true,
                celda: (f) => (
                  <span className={f.incidenciasCriticasAbiertas > 0 ? "text-crit" : ""}>
                    {f.incidenciasCriticasAbiertas}
                  </span>
                ),
              },
            ]}
          />
        )}
      </Bloque>
    </div>
  );
}

// -------- vista --------

const TABS = [
  { clave: "ejecucion", etiqueta: "Ejecución" },
  { clave: "recursos", etiqueta: "Personas y flota" },
  { clave: "negocio", etiqueta: "Cumplimiento y negocio" },
  { clave: "financiero", etiqueta: "Financiero" },
] as const;

type TabClave = (typeof TABS)[number]["clave"];

export function ControlOperacional() {
  const [tab, setTab] = useState<TabClave>("ejecucion");
  const [dias, setDias] = useState<30 | 90>(30);
  const hasta = hoyBogota();
  const desde = sumarDias(hasta, -dias);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-panel-850/50 p-1">
          {TABS.map((t) => (
            <button
              key={t.clave}
              onClick={() => setTab(t.clave)}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] transition-colors ${
                tab === t.clave
                  ? "bg-panel-750 text-fg ring-1 ring-inset ring-line"
                  : "text-muted hover:text-fg"
              }`}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="eyebrow">Ventana</span>
          {([30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDias(d)}
              className={`rounded-lg px-3 py-1.5 font-mono text-[12px] transition-colors ${
                dias === d
                  ? "bg-signal text-signal-ink"
                  : "border border-line text-muted hover:text-fg"
              }`}
            >
              {d} d
            </button>
          ))}
          <span className="hidden font-mono text-[11px] text-faint sm:inline">
            {desde} → {hasta}
          </span>
        </div>
      </div>

      {tab === "ejecucion" && <TabEjecucion desde={desde} hasta={hasta} />}
      {tab === "recursos" && <TabRecursos desde={desde} hasta={hasta} />}
      {tab === "negocio" && <TabNegocio desde={desde} hasta={hasta} />}
      {tab === "financiero" && <TabFinanciero />}

      <p className="px-1 font-mono text-[11px] text-faint">
        Señales analíticas de <span className="text-muted">analisis.*</span> · ventana {dias} días.
      </p>
    </div>
  );
}
