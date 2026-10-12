import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Locate a bundled asset (backend/assets/*) from src/lib, from dist/, or from a different working directory (serverless). */
export function findAsset(name: string): string | null {
  const candidates = [
    process.env.ASSETS_DIR && path.join(process.env.ASSETS_DIR, name),
    path.join(here, "..", "..", "assets", name),
    path.join(here, "..", "assets", name),
    path.join(process.cwd(), "assets", name),
    path.join(process.cwd(), "backend", "assets", name),
  ].filter((p): p is string => Boolean(p));
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

export function readAsset(name: string): Buffer | null {
  const p = findAsset(name);
  return p ? fs.readFileSync(p) : null;
}
