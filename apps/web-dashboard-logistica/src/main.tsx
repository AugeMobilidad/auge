import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider } from "convex/react";
import { convex } from "./convexClient";
import { SesionProvider } from "./auth/session";
import { App } from "./App";
import "./index.css";

const raiz = document.getElementById("root");
if (raiz === null) throw new Error("No se encontró #root");

createRoot(raiz).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <SesionProvider>
        <App />
      </SesionProvider>
    </ConvexProvider>
  </StrictMode>,
);
