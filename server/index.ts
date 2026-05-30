import "dotenv/config";
import express from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";

const app = express();

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "questivity-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 },
  }),
);

// Lightweight API request logger.
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    const start = Date.now();
    res.on("finish", () => {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
    });
  }
  next();
});

async function main() {
  const server = await registerRoutes(app);

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT) || 5000;
  server.listen(port, () => {
    console.log(`Questivity server listening on http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
