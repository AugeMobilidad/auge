/**
 * Sesión del dashboard — ÚNICO módulo con lógica de actor/identidad.
 *
 * Auth de desarrollo (swap-ready): mientras no exista un proveedor real, el
 * actor se elige de la lista de `usuariosSistema` activos y se guarda en
 * localStorage. TODA mutation `dashboard*` toma su `actorUsuarioSistemaId` de
 * aquí (ver `useAcciones` en ./acciones.ts). La ruta de migración a auth real
 * (Clerk + ctx.auth.getUserIdentity) está documentada en el README de la app.
 *
 * El resto de la UI nunca manipula ids de actor: consume `useActor()` /
 * `useSesion()` y los hooks de acción. Cambiar de dev-login a Clerk toca solo
 * este directorio y las firmas de las mutations en Convex.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

export type Permiso =
  | "despachar"
  | "gestionarIncidencias"
  | "gestionarDocumentos"
  | "aprobarLiquidaciones"
  | "verEventos"
  | "administrar";

export type UsuarioSesion = {
  id: Id<"usuariosSistema">;
  nombre: string;
  tipoUsuario: string;
  email?: string;
  permisos: Permiso[];
};

const CLAVE_STORAGE = "auge.dashboard.actorId";

type SesionCtx = {
  cargando: boolean;
  actor: UsuarioSesion | null;
  usuarios: UsuarioSesion[];
  iniciarSesion: (id: Id<"usuariosSistema">) => void;
  cerrarSesion: () => void;
};

const Contexto = createContext<SesionCtx | null>(null);

export function SesionProvider({ children }: { children: ReactNode }) {
  const crudos = useQuery(api.dev.usuarios.listarUsuariosSistema);
  const [actorId, setActorId] = useState<Id<"usuariosSistema"> | null>(() => {
    const guardado = localStorage.getItem(CLAVE_STORAGE);
    return guardado ? (guardado as Id<"usuariosSistema">) : null;
  });

  const usuarios = useMemo<UsuarioSesion[]>(
    () =>
      (crudos ?? []).map((u) => ({
        id: u.usuarioSistemaId,
        nombre: u.nombre,
        tipoUsuario: u.tipoUsuario,
        email: u.email,
        permisos: u.permisos as Permiso[],
      })),
    [crudos],
  );

  const iniciarSesion = useCallback((id: Id<"usuariosSistema">) => {
    localStorage.setItem(CLAVE_STORAGE, id);
    setActorId(id);
  }, []);

  const cerrarSesion = useCallback(() => {
    localStorage.removeItem(CLAVE_STORAGE);
    setActorId(null);
  }, []);

  const actor = useMemo(
    () => usuarios.find((u) => u.id === actorId) ?? null,
    [usuarios, actorId],
  );

  // Si el actor guardado ya no existe/está inactivo, se limpia la sesión.
  useEffect(() => {
    if (actorId !== null && crudos !== undefined && actor === null) {
      cerrarSesion();
    }
  }, [actorId, crudos, actor, cerrarSesion]);

  const valor = useMemo<SesionCtx>(
    () => ({ cargando: crudos === undefined, actor, usuarios, iniciarSesion, cerrarSesion }),
    [crudos, actor, usuarios, iniciarSesion, cerrarSesion],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): SesionCtx {
  const ctx = useContext(Contexto);
  if (ctx === null) throw new Error("useSesion debe usarse dentro de <SesionProvider>");
  return ctx;
}

/** Actor garantizado (para el árbol autenticado). Lanza si no hay sesión. */
export function useActor(): UsuarioSesion {
  const { actor } = useSesion();
  if (actor === null) throw new Error("No hay actor en sesión");
  return actor;
}

export function usePermiso(permiso: Permiso): boolean {
  const { actor } = useSesion();
  return actor?.permisos.includes(permiso) ?? false;
}
