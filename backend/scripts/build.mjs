// Bundles the API (and the shared workspace package) into one ESM file: dist/server.mjs
import { build } from "esbuild";
import fs from "node:fs";

fs.rmSync("dist", { recursive: true, force: true });
await build({
  entryPoints: { server: "src/server.ts", app: "src/app.ts", index: "src/index.ts", migrate: "scripts/migrate.ts" },
  outdir: "dist",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  packages: "external", // node_modules stay external; @moonstar/shared is bundled below
  alias: { "@moonstar/shared": "../packages/shared/src/index.ts" },
  minify: false,
  sourcemap: true,
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: "info",
});
console.log("API built to dist/");
