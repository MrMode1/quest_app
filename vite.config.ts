import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, "client"),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist", "public"),
    emptyOutDir: true,
  },
  server: {
    // Used only when running Vite standalone. In normal `npm run dev` the
    // Express server mounts Vite in middleware mode (see server/vite.ts).
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
});
