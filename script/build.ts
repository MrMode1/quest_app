import { build as viteBuild } from "vite";
import { build as esbuild } from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const sharedAlias = { "@shared": path.resolve(root, "shared") };

async function main() {
  // 1) Build the frontend with Vite -> public/
  console.log("Building client with Vite...");
  await viteBuild({ configFile: path.resolve(root, "vite.config.ts") });

  // 2) Bundle the server with esbuild -> dist/index.cjs (CJS, for Railway/local)
  console.log("Bundling server with esbuild...");
  await esbuild({
    entryPoints: [path.resolve(root, "server", "index.ts")],
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node20",
    outfile: path.resolve(root, "dist", "index.cjs"),
    packages: "external",
    alias: sharedAlias,
  });

  // 3) Bundle Vercel API function -> api/[...path].js (CJS, local code bundled inline)
  console.log("Bundling Vercel API function...");
  await esbuild({
    entryPoints: [path.resolve(root, "server", "vercel-entry.ts")],
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node20",
    outfile: path.resolve(root, "api", "[...path].js"),
    packages: "external",
    alias: sharedAlias,
  });

  console.log("Build complete -> dist/ + api/*.js");
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
