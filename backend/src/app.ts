import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import compression from "compression";
import helmet from "helmet";
import { SESSION_COOKIE, parseCookies, sessionFromToken, type Session } from "./lib/auth";
import { errorResponse } from "./lib/server";
export { route, ip } from "./http";
import { hasDatabaseUrl, query } from "./db/index";
import { authRoutes } from "./routes/auth";
import { portalRoutes } from "./routes/portal";
import { publicRoutes } from "./routes/public";

declare module "express-serve-static-core" {
  interface Locals {
    session: Session | null;
    token?: string;
  }
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);
  app.set("etag", "strong");
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "same-site" } }));
  app.use(compression({ threshold: 512 })); // compress API payloads
  app.use(express.json({ limit: "1mb" }));

  // CSRF defence in depth: state-changing requests must come from an allowed origin and carry JSON.
  const allowed = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  app.use((req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const origin = req.headers.origin;
    if (origin) {
      let host = "";
      try {
        host = new URL(origin).host;
      } catch {
        return res.status(403).json({ error: "Bad origin" });
      }
      const mine = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "");
      const ok = host === mine || allowed.some((a) => a === origin || a === host) || (process.env.NODE_ENV !== "production" && /^localhost(:\d+)?$/.test(host));
      if (!ok) return res.status(403).json({ error: "Origin not allowed" });
    } else if (process.env.NODE_ENV === "production" && !String(req.headers["content-type"] ?? "").includes("application/json")) {
      return res.status(415).json({ error: "JSON required" });
    }
    next();
  });

  // Server-side session verification on every request.
  app.use(async (req, res, next) => {
    try {
      const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
      res.locals.token = token;
      res.locals.session = await sessionFromToken(token);
      next();
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/health", async (_req, res) => {
    try {
      await query("SELECT 1");
      res.json({ ok: true, db: hasDatabaseUrl() ? "postgres" : "embedded" });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.use("/api/public", publicRoutes());
  app.use("/api/auth", authRoutes());
  app.use("/api/portal", (_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    next();
  }, portalRoutes());

  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const { status, body } = errorResponse(err);
    if (!res.headersSent) res.status(status).json(body);
  });
  return app;
}
