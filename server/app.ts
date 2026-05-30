import "dotenv/config";
import express from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { isVercel } from "./lib/env";

const isProduction = process.env.NODE_ENV === "production";

/** Build the Express app (shared by Railway/local and Vercel). */
export function buildApp(): express.Express {
  const app = express();

  if (isProduction) {
    app.set("trust proxy", 1);
  }

  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: false }));

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "questivity-dev-secret",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: isProduction, maxAge: 1000 * 60 * 60 * 24 },
    }),
  );

  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      const start = Date.now();
      res.on("finish", () => {
        console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
      });
    }
    next();
  });

  registerRoutes(app);

  // Vercel serves static assets from public/ via CDN; no SPA fallback needed here.
  if (isVercel) {
    app.get("/health", (_req, res) => res.json({ ok: true }));
  }

  return app;
}

export default buildApp();
