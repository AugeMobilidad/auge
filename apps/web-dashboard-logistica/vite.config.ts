import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// El dashboard consume el mismo backend Convex local. La URL es siempre
// env-driven (VITE_CONVEX_URL); ver src/convexClient.ts.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@convex": path.resolve(__dirname, "../../convex"),
    },
  },
});
