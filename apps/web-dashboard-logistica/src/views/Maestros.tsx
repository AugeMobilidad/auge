import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { usePermiso } from "@/auth/session";
import { Badge, Boton, Cargando, Panel, TituloSeccion, Vacio } from "@/components/ui";
import {
  ClienteModal,
  OperacionModal,
  ParadaModal,
  ProgramaModal,
  RutaModal,
  type ClienteMaestro,
  type OperacionMaestra,
  type ParadaMaestra,
  type RutaMaestra,
} from "@/components/MaestrosModales";

type Pestaña = "clientes" | "programas" | "operaciones" | "rutas";
type ModalActivo =
  | { tipo: "cliente"; cliente?: ClienteMaestro }
  | { tipo: "programa" }
  | { tipo: "operacion"; operacion?: OperacionMaestra }
  | { tipo: "ruta"; ruta?: RutaMaestra }
  | { tipo: "parada"; parada?: ParadaMaestra };

const PESTAÑAS: Array<{ id: Pestaña; etiqueta: string }> = [
  { id: "clientes", etiqueta: "Clientes" },
  { id: "programas", etiqueta: "Programas" },
  { id: "operaciones", etiqueta: "Operaciones" },
  { id: "rutas", etiqueta: "Rutas" },
];

export function Maestros() {
  const puedeAdministrar = usePermiso("administrar");
  const [pestaña, setPestaña] = useState<Pestaña>("clientes");
  const [modal, setModal] = useState<ModalActivo | null>(null);
  const [rutaSeleccionada, setRutaSeleccionada] = useState<Id<"rutas"> | null>(null);

  const clientes = useQuery(api.appDashboard.dashboardMaestroListaClientes, {});
  const programas = useQuery(api.appDashboard.dashboardMaestroListaProgramas, {});
  const operaciones = useQuery(api.appDashboard.dashboardMaestroListaOperaciones, {});
  const rutas = useQuery(api.appDashboard.dashboardMaestroListaRutas, {});
  const paradas = useQuery(
    api.appDashboard.dashboardMaestroListaParadas,
    rutaSeleccionada === null ? "skip" : { rutaId: rutaSeleccionada },
  );

  const rutaActual = useMemo(
    () => rutas?.find((ruta) => ruta.rutaId === rutaSeleccionada) ?? null,
    [rutas, rutaSeleccionada],
  );
  const siguienteOrden = (paradas?.at(-1)?.orden ?? 0) + 1;

  if (!puedeAdministrar) {
    return (
      <Panel className="max-w-2xl p-6">
        <TituloSeccion eyebrow="Acceso restringido" titulo="No autorizado" />
        <p className="mt-3 text-sm text-muted">
          Tu usuario no tiene permiso para administrar datos maestros.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-5">
      <Panel className="p-3">
        <div className="flex flex-wrap gap-1">
          {PESTAÑAS.map((item) => (
            <button
              key={item.id}
              onClick={() => setPestaña(item.id)}
              className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                pestaña === item.id
                  ? "bg-signal text-signal-ink"
                  : "text-muted hover:bg-panel-750 hover:text-fg"
              }`}
            >
              {item.etiqueta}
            </button>
          ))}
        </div>
      </Panel>

      {pestaña === "clientes" && (
        <Seccion
          titulo="Clientes"
          eyebrow="Comercial"
          accion={<Boton variante="primario" onClick={() => setModal({ tipo: "cliente" })}>+ Nuevo</Boton>}
        >
          {clientes === undefined ? (
            <Cargando filas={5} />
          ) : clientes.length === 0 ? (
            <Vacio>No hay clientes configurados.</Vacio>
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <Th>Cliente</Th>
                  <Th>Tipo</Th>
                  <Th>Contacto</Th>
                  <Th>Ciudad</Th>
                  <Th>Estado</Th>
                  <Th>Acción</Th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((cliente) => (
                  <tr key={cliente.clienteId}>
                    <Td fuerte>{cliente.nombre}</Td>
                    <Td>{cliente.tipo}</Td>
                    <Td>{cliente.contactoPrincipal}<Detalle>{cliente.telefono}</Detalle></Td>
                    <Td>{cliente.ciudad}</Td>
                    <Td><Badge tono={cliente.estado === "activo" ? "ok" : "neutro"}>{cliente.estado}</Badge></Td>
                    <Td derecha><Boton onClick={() => setModal({ tipo: "cliente", cliente })}>Editar</Boton></Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
        </Seccion>
      )}

      {pestaña === "programas" && (
        <Seccion
          titulo="Programas"
          eyebrow="Estructura"
          accion={<Boton variante="primario" onClick={() => setModal({ tipo: "programa" })}>+ Nuevo</Boton>}
        >
          {programas === undefined ? (
            <Cargando filas={5} />
          ) : programas.length === 0 ? (
            <Vacio>No hay programas configurados.</Vacio>
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <Th>Programa</Th>
                  <Th>Cliente</Th>
                  <Th>Tipo</Th>
                  <Th>Vigencia</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {programas.map((programa) => (
                  <tr key={programa.programaId}>
                    <Td fuerte>{programa.nombre}<Detalle>{programa.modalidadPago}</Detalle></Td>
                    <Td>{programa.clienteNombre}</Td>
                    <Td>{programa.tipoServicio}</Td>
                    <Td>{programa.fechaInicio}<Detalle>{programa.fechaFin ?? "sin cierre"}</Detalle></Td>
                    <Td><Badge tono={programa.estado === "activo" ? "ok" : "neutro"}>{programa.estado}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
        </Seccion>
      )}

      {pestaña === "operaciones" && (
        <Seccion
          titulo="Operaciones"
          eyebrow="Ejecución"
          accion={<Boton variante="primario" onClick={() => setModal({ tipo: "operacion" })}>+ Nuevo</Boton>}
        >
          {operaciones === undefined ? (
            <Cargando filas={5} />
          ) : operaciones.length === 0 ? (
            <Vacio>No hay operaciones configuradas.</Vacio>
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <Th>Operación</Th>
                  <Th>Programa</Th>
                  <Th>Tipo</Th>
                  <Th>Control</Th>
                  <Th>Estado</Th>
                  <Th>Acción</Th>
                </tr>
              </thead>
              <tbody>
                {operaciones.map((operacion) => (
                  <tr key={operacion.operacionId}>
                    <Td fuerte>{operacion.nombre}<Detalle>{operacion.ciudadBase ?? "sin ciudad"}</Detalle></Td>
                    <Td>{operacion.programaNombre}<Detalle>{operacion.clienteNombre}</Detalle></Td>
                    <Td>{operacion.tipoOperacion}</Td>
                    <Td>{operacion.nivelControl}</Td>
                    <Td><Badge tono={operacion.estado === "enCurso" ? "ok" : "neutro"}>{operacion.estado}</Badge></Td>
                    <Td derecha><Boton onClick={() => setModal({ tipo: "operacion", operacion })}>Editar</Boton></Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
        </Seccion>
      )}

      {pestaña === "rutas" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.8fr)]">
          <Seccion
            titulo="Rutas"
            eyebrow="Recorridos"
            accion={<Boton variante="primario" onClick={() => setModal({ tipo: "ruta" })}>+ Nuevo</Boton>}
          >
            {rutas === undefined ? (
              <Cargando filas={5} />
            ) : rutas.length === 0 ? (
              <Vacio>No hay rutas configuradas.</Vacio>
            ) : (
              <Tabla>
                <thead>
                  <tr>
                    <Th>Ruta</Th>
                    <Th>Programa</Th>
                    <Th>Frecuencia</Th>
                    <Th>Activa</Th>
                    <Th>Acción</Th>
                  </tr>
                </thead>
                <tbody>
                  {rutas.map((ruta) => (
                    <tr
                      key={ruta.rutaId}
                      className={ruta.rutaId === rutaSeleccionada ? "bg-panel-750/40" : ""}
                    >
                      <Td fuerte>{ruta.nombre}<Detalle>{ruta.origenPrincipal} → {ruta.destinoPrincipal}</Detalle></Td>
                      <Td>{ruta.programaNombre}</Td>
                      <Td>{ruta.frecuencia}</Td>
                      <Td><Badge tono={ruta.activa ? "ok" : "neutro"}>{ruta.activa ? "activa" : "inactiva"}</Badge></Td>
                      <Td derecha>
                        <div className="flex justify-end gap-2">
                          <Boton onClick={() => setRutaSeleccionada(ruta.rutaId)}>Paradas</Boton>
                          <Boton onClick={() => setModal({ tipo: "ruta", ruta })}>Editar</Boton>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            )}
          </Seccion>

          <Seccion
            titulo="Paradas"
            eyebrow={rutaActual?.nombre ?? "Selecciona una ruta"}
            accion={
              rutaSeleccionada !== null ? (
                <Boton variante="primario" onClick={() => setModal({ tipo: "parada" })}>+ Nueva</Boton>
              ) : null
            }
          >
            {rutaSeleccionada === null ? (
              <Vacio>Selecciona una ruta para administrar sus paradas.</Vacio>
            ) : paradas === undefined ? (
              <Cargando filas={4} />
            ) : paradas.length === 0 ? (
              <Vacio>Esta ruta no tiene paradas.</Vacio>
            ) : (
              <div className="space-y-2">
                {paradas.map((parada) => (
                  <div
                    key={parada.paradaId}
                    className="rounded-lg border border-line bg-panel-850/60 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-fg">#{parada.orden} {parada.nombre}</div>
                        <div className="mt-1 text-xs text-muted">{parada.direccionTexto}</div>
                        <div className="mt-2 flex gap-2">
                          <Badge tono={parada.activa ? "ok" : "neutro"}>{parada.activa ? "activa" : "inactiva"}</Badge>
                          {(parada.ventanaInicio || parada.ventanaFin) && (
                            <Badge tono="info">{parada.ventanaInicio ?? "--:--"}-{parada.ventanaFin ?? "--:--"}</Badge>
                          )}
                        </div>
                      </div>
                      <Boton onClick={() => setModal({ tipo: "parada", parada })}>Editar</Boton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Seccion>
        </div>
      )}

      {modal?.tipo === "cliente" && (
        <ClienteModal cliente={modal.cliente} onCerrar={() => setModal(null)} />
      )}
      {modal?.tipo === "programa" && clientes !== undefined && (
        <ProgramaModal clientes={clientes} onCerrar={() => setModal(null)} />
      )}
      {modal?.tipo === "operacion" && programas !== undefined && (
        <OperacionModal
          programas={programas}
          operacion={modal.operacion}
          onCerrar={() => setModal(null)}
        />
      )}
      {modal?.tipo === "ruta" && programas !== undefined && (
        <RutaModal programas={programas} ruta={modal.ruta} onCerrar={() => setModal(null)} />
      )}
      {modal?.tipo === "parada" && rutaSeleccionada !== null && (
        <ParadaModal
          rutaId={rutaSeleccionada}
          parada={modal.parada}
          siguienteOrden={siguienteOrden}
          onCerrar={() => setModal(null)}
        />
      )}
    </div>
  );
}

function Seccion({
  eyebrow,
  titulo,
  accion,
  children,
}: {
  eyebrow: string;
  titulo: string;
  accion?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Panel className="p-5">
      <TituloSeccion eyebrow={eyebrow} titulo={titulo} accion={accion} />
      <div className="mt-4">{children}</div>
    </Panel>
  );
}

function Tabla({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
        {children}
      </table>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="border-b border-line px-3 py-2 font-mono text-[10.5px] uppercase tracking-widest text-faint">
      {children}
    </th>
  );
}

function Td({
  children,
  fuerte = false,
  derecha = false,
}: {
  children: ReactNode;
  fuerte?: boolean;
  derecha?: boolean;
}) {
  return (
    <td
      className={`border-b border-line/70 px-3 py-3 align-top ${
        fuerte ? "font-medium text-fg" : "text-muted"
      } ${derecha ? "text-right" : ""}`}
    >
      {children}
    </td>
  );
}

function Detalle({ children }: { children: ReactNode }) {
  return <div className="mt-0.5 text-[12px] font-normal text-faint">{children}</div>;
}
