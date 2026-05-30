import { build as viteBuild } from "vite";
import { build as esbuild } from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

async function main() {
  // 1) Build the frontend with Vite -> public/
  console.log("Building client with Vite...");
  await viteBuild({ configFile: path.resolve(root, "vite.config.ts") });

  // 2) Bundle the server with esbuild -> dist/index.js (ESM)
  console.log("Bundling server with esbuild...");
  await esbuild({
    entryPoints: [path.resolve(root, "server", "index.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    outfile: path.resolve(root, "dist", "index.js"),
    // Make ALL dependencies external (Node builtins + every npm package).
    // Bundling npm packages here causes CJS/ESM interop conflicts.
    packages: "external",
    // Resolve the @shared/* path alias at build time.
    alias: {
      "@shared": path.resolve(root, "shared"),
    },
    banner: {
      js: [
        'import { fileURLToPath as __ftu } from "url";',
        'import { dirname as __dn } from "path";',
        "const __filename = __ftu(import.meta.url);",
        "const __dirname = __dn(__filename);",
      ].join("\n"),
    },
  });

  console.log("Build complete -> dist/");
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
