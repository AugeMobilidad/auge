import { useSyncExternalStore, useCallback } from "react";
import type { Id } from "@convex/_generated/dataModel";

export type Ruta =
  | { vista: "resumen" }
  | { vista: "despacho" }
  | { vista: "servicio"; id: Id<"serviciosTransporte"> }
  | { vista: "incidencias" }
  | { vista: "telegram" }
  | { vista: "disponibilidad" }
  | { vista: "maestros" }
  | { vista: "control" };

export type VistaPrincipal = Exclude<Ruta["vista"], "servicio">;

function leerHash(): Ruta {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [seg, arg] = hash.split("/");
  switch (seg) {
    case "despacho":
      return { vista: "despacho" };
    case "servicio":
      return arg
        ? { vista: "servicio", id: arg as Id<"serviciosTransporte"> }
        : { vista: "despacho" };
    case "incidencias":
      return { vista: "incidencias" };
    case "telegram":
      return { vista: "telegram" };
    case "disponibilidad":
      return { vista: "disponibilidad" };
    case "maestros":
      return { vista: "maestros" };
    case "control":
      return { vista: "control" };
    default:
      return { vista: "resumen" };
  }
}

function subscribe(cb: () => void): () => void {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

let cacheHash = "";
let cacheRuta: Ruta = leerHash();

function snapshot(): Ruta {
  if (window.location.hash !== cacheHash) {
    cacheHash = window.location.hash;
    cacheRuta = leerHash();
  }
  return cacheRuta;
}

export function navegar(ruta: Ruta): void {
  const destino =
    ruta.vista === "servicio" ? `#/servicio/${ruta.id}` : `#/${ruta.vista}`;
  if (window.location.hash !== destino) window.location.hash = destino;
}

export function useRuta(): Ruta {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function useNavegar(): (ruta: Ruta) => void {
  return useCallback(navegar, []);
}
