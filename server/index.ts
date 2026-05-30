import "dotenv/config";
import { createServer } from "http";
import { buildApp } from "./app";
import { setupVite, serveStatic } from "./vite";

async function main() {
  const app = buildApp();
  const server = createServer(app);

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT) || 5000;
  const host = "0.0.0.0";
  server.listen(port, host, () => {
    console.log(`Questivity server listening on http://${host}:${port}`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
