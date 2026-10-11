import { Router } from "express";
import { z } from "zod";
import { route, ip } from "../http";
import { HttpError, SESSION_COOKIE, demoLogin, isDemoMode, login, logout, need } from "../lib/auth";
import { changeOwnPassword } from "../lib/admin";
import { getSetting, type CompanySettings } from "../lib/server";

const secure = () => process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1";

export function authRoutes() {
  const r = Router();

  r.post("/login", route(async (req, res) => {
    const { email, password } = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) }).parse(req.body);
    const out = await login(email, password, ip(req), req.headers["user-agent"]);
    if (!out.ok) throw new HttpError(out.status, out.error);
    res.cookie(SESSION_COOKIE, out.token, { httpOnly: true, sameSite: "lax", secure: secure(), path: "/", maxAge: out.maxAge * 1000 });
    res.json({ ok: true });
  }));

  // Sandbox only: 404 on every real deployment.
  r.post("/demo-login", route(async (req, res) => {
    const out = await demoLogin(ip(req), req.headers["user-agent"]);
    res.cookie(SESSION_COOKIE, out.token, { httpOnly: true, sameSite: "lax", secure: secure(), path: "/", maxAge: out.maxAge * 1000 });
    res.json({ ok: true });
  }));
  r.get("/mode", (_req, res) => void res.json({ demo: isDemoMode() }));

  r.post("/logout", route(async (_req, res) => {
    await logout(res.locals.token);
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.json({ ok: true });
  }));

  r.get("/me", route(async (_req, res) => {
    const s = res.locals.session;
    if (!s) return void res.status(401).json({ error: "Not signed in" });
    const company = await getSetting<CompanySettings>("company", {} as CompanySettings);
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ user: s.user, permissions: [...s.perms], timezone: company.timezone || "Asia/Dhaka" });
  }));

  r.post("/password", route(async (req, res) => {
    const s = need(res.locals.session);
    const { current, next } = z.object({ current: z.string().min(1), next: z.string().min(1) }).parse(req.body);
    await changeOwnPassword(s, current, next);
    res.json({ ok: true });
  }));

  return r;
}
