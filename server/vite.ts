import type { Express } from "express";
import type { Server } from "http";
import express from "express";
import fs from "fs";
import path from "path";

const clientRoot = path.resolve(process.cwd(), "client");
const staticRoot = path.resolve(process.cwd(), "public");

/** Dev: mount Vite in middleware mode so the server serves the SPA + HMR. */
export async function setupVite(app: Express, server: Server) {
  const { createServer: createViteServer } = await import("vite");
  const configFile = path.resolve(process.cwd(), "vite.config.ts");
  const vite = await createViteServer({
    configFile,
    appType: "custom",
    server: { middlewareMode: true, hmr: { server } },
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    try {
      const url = req.originalUrl;
      const templatePath = path.resolve(clientRoot, "index.html");
      let template = await fs.promises.readFile(templatePath, "utf-8");
      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

/** Prod: serve the built client from public/ with SPA fallback. */
export function serveStatic(app: Express) {
  if (!fs.existsSync(staticRoot)) {
    throw new Error(`Build output not found at ${staticRoot}. Run "npm run build" first.`);
  }
  app.use(express.static(staticRoot));
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(staticRoot, "index.html"));
  });
}
