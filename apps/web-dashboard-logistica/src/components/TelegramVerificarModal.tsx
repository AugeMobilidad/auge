import { useEffect, useMemo, useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { Modal, Boton, Etiqueta, Select, Input, ErrorLinea, Cargando } from "./ui";
import { useAcciones } from "@/auth/acciones";

type CuentaPendiente = {
  cuentaId: Id<"telegramCuentas">;
  telegramUserId: string;
  telegramChatId: string;
  username?: string;
  telefono?: string;
  solicitadaEn?: number;
};

type Conductor = {
  conductorId: Id<"conductores">;
  nombre: string;
  cedula: string;
  telefono: string;
};

type UsuarioSistema = {
  usuarioSistemaId: Id<"usuariosSistema">;
  nombre: string;
  tipoUsuario: string;
  telefono?: string;
  email?: string;
};

type Candidatos = {
  conductores: Conductor[];
  usuariosSistema: UsuarioSistema[];
};

function normalizar(texto: string): string {
  return texto.trim().toLowerCase();
}

export function TelegramVerificarModal({
  cuenta,
  candidatos,
  onCerrar,
  onExito,
}: {
  cuenta: CuentaPendiente;
  candidatos: Candidatos | undefined;
  onCerrar: () => void;
  onExito: () => void;
}) {
  const acciones = useAcciones();
  const [tipo, setTipo] = useState<"conductor" | "usuarioSistema">("conductor");
  const [filtro, setFiltro] = useState(cuenta.telefono ?? "");
  const [seleccion, setSeleccion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setSeleccion("");
  }, [tipo, filtro]);

  const conductoresFiltrados = useMemo(() => {
    const f = normalizar(filtro);
    const filas = candidatos?.conductores ?? [];
    if (f === "") return filas.slice(0, 40);
    return filas
      .filter((c) =>
        normalizar(`${c.nombre} ${c.telefono} ${c.cedula}`).includes(f),
      )
      .slice(0, 40);
  }, [candidatos, filtro]);

  const usuariosFiltrados = useMemo(() => {
    const f = normalizar(filtro);
    const filas = candidatos?.usuariosSistema ?? [];
    if (f === "") return filas.slice(0, 40);
    return filas
      .filter((u) =>
        normalizar(`${u.nombre} ${u.telefono ?? ""} ${u.email ?? ""} ${u.tipoUsuario}`).includes(f),
      )
      .slice(0, 40);
  }, [candidatos, filtro]);

  async function confirmar() {
    if (seleccion === "") return;
    setError(null);
    setEnviando(true);
    try {
      if (tipo === "conductor") {
        await acciones.verificarCuentaTelegram({
          cuentaId: cuenta.cuentaId,
          conductorId: seleccion as Id<"conductores">,
        });
      } else {
        await acciones.verificarCuentaTelegram({
          cuentaId: cuenta.cuentaId,
          usuarioSistemaId: seleccion as Id<"usuariosSistema">,
        });
      }
      onExito();
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al verificar la cuenta");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      eyebrow="Telegram"
      titulo="Verificar cuenta pendiente"
      onCerrar={onCerrar}
      footer={
        <>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            onClick={confirmar}
            disabled={seleccion === "" || candidatos === undefined || enviando}
          >
            {enviando ? "Verificando..." : "Confirmar vínculo"}
          </Boton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-line bg-base-950/40 px-3 py-2">
          <div className="font-mono text-[11px] text-muted">
            {cuenta.username ? `@${cuenta.username}` : "Sin username"} · {cuenta.telefono ?? "sin teléfono"}
          </div>
          <div className="mt-1 truncate font-mono text-[11px] text-faint">
            user {cuenta.telegramUserId} · chat {cuenta.telegramChatId}
          </div>
        </div>

        <div>
          <Etiqueta>Tipo de registro</Etiqueta>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTipo("conductor")}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                tipo === "conductor"
                  ? "border-signal bg-signal/10 text-signal"
                  : "border-line bg-base-950/40 text-muted hover:text-fg"
              }`}
            >
              Conductor
            </button>
            <button
              type="button"
              onClick={() => setTipo("usuarioSistema")}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                tipo === "usuarioSistema"
                  ? "border-signal bg-signal/10 text-signal"
                  : "border-line bg-base-950/40 text-muted hover:text-fg"
              }`}
            >
              Usuario sistema
            </button>
          </div>
        </div>

        <div>
          <Etiqueta>Buscar</Etiqueta>
          <Input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder={
              tipo === "conductor"
                ? "Nombre, teléfono o cédula"
                : "Nombre, teléfono, email o tipo"
            }
          />
        </div>

        <div>
          <Etiqueta>Registro existente</Etiqueta>
          {candidatos === undefined ? (
            <Cargando filas={2} />
          ) : (
            <Select value={seleccion} onChange={(e) => setSeleccion(e.target.value)}>
              <option value="">Seleccionar...</option>
              {tipo === "conductor"
                ? conductoresFiltrados.map((c) => (
                    <option key={c.conductorId} value={c.conductorId}>
                      {c.nombre} · {c.telefono} · CC {c.cedula}
                    </option>
                  ))
                : usuariosFiltrados.map((u) => (
                    <option key={u.usuarioSistemaId} value={u.usuarioSistemaId}>
                      {u.nombre} · {u.tipoUsuario}
                      {u.telefono ? ` · ${u.telefono}` : ""}
                      {u.email ? ` · ${u.email}` : ""}
                    </option>
                  ))}
            </Select>
          )}
        </div>

        <ErrorLinea mensaje={error} />
      </div>
    </Modal>
  );
}
