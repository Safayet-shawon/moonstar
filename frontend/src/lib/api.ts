import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { PermKey } from "@moonstar/shared";

const BACKEND = (process.env.BACKEND_URL ?? "http://localhost:4000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Opts = { revalidate?: number; tags?: string[]; authed?: boolean };

/** Server-side call to the backend API. Forwards the visitor's session cookie for portal calls. */
export async function apiGet<T>(path: string, opts: Opts = { authed: true }): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (opts.authed !== false) {
    const jar = await cookies();
    const c = jar.toString();
    if (c) headers.cookie = c;
  }
  const init: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = { headers };
  if (opts.revalidate !== undefined) init.next = { revalidate: opts.revalidate, tags: opts.tags };
  else init.cache = "no-store";
  let res: Response;
  try {
    res = await fetch(`${BACKEND}/api${path}`, init);
  } catch {
    throw new ApiError(503, "The service is temporarily unavailable.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (body as { error?: string }).error ?? "Request failed");
  return body as T;
}

export type Me = { user: { id: string; email: string; name: string; role: string; roleName: string; designation: string | null; mustChangePassword: boolean }; permissions: string[]; timezone: string };

export const getMe = cache(async (): Promise<Me | null> => {
  try {
    return await apiGet<Me>("/auth/me");
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
});

export async function requireMe(): Promise<Me> {
  const me = await getMe();
  if (!me) redirect("/portal/login");
  return me;
}

/** Page-level gate (the API enforces the same rules independently). */
export async function requirePerm(...keys: PermKey[]): Promise<Me> {
  const me = await requireMe();
  if (!keys.some((k) => me.permissions.includes(k))) redirect("/portal?denied=1");
  return me;
}

export const has = (me: Me, k: PermKey) => me.permissions.includes(k);

/** Load a portal resource; map 404 to notFound-friendly null and bounce unauthenticated users. */
export async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 401) redirect("/portal/login");
      if (e.status === 403) redirect("/portal?denied=1");
      if (e.status === 404) return null;
    }
    throw e;
  }
}
