import { createApp } from "./app";
import { getDb } from "./db/index";

// load backend/.env if present (never committed)
try { process.loadEnvFile(); } catch { /* no .env file */ }

const port = Number(process.env.PORT ?? 4000);
const app = createApp();

getDb()
  .then((d) => {
    const server = app.listen(port, () => console.log(`[api] listening on :${port} (db: ${d.kind})`));
    const shutdown = () => server.close(() => process.exit(0));
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  })
  .catch((e) => {
    console.error("[api] failed to start:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
