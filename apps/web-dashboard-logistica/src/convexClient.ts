import { ConvexReactClient } from "convex/react";

// La URL del deployment es SIEMPRE env-driven. En dev local Convex sirve en
// 127.0.0.1:3210; ese valor es solo un respaldo para no romper el arranque.
const url = import.meta.env.VITE_CONVEX_URL ?? "http://127.0.0.1:3210";

export const convex = new ConvexReactClient(url);
