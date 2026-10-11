"use client";

export class ClientApiError extends Error {
  constructor(public status: number, message: string, public issues?: { path: string; message: string }[]) {
    super(message);
  }
}

export async function call<T = unknown>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith("/auth/login")) {
    window.location.assign("/portal/login"); // full reload clears client state
    throw new ClientApiError(401, "Session expired");
  }
  if (!res.ok) throw new ClientApiError(res.status, (data as { error?: string }).error ?? "Request failed", (data as { issues?: { path: string; message: string }[] }).issues);
  return data as T;
}

export const api = {
  get: <T = unknown>(p: string, s?: AbortSignal) => call<T>("GET", p, undefined, s),
  post: <T = unknown>(p: string, b?: unknown) => call<T>("POST", p, b ?? {}),
  put: <T = unknown>(p: string, b?: unknown) => call<T>("PUT", p, b ?? {}),
  patch: <T = unknown>(p: string, b?: unknown) => call<T>("PATCH", p, b ?? {}),
  del: <T = unknown>(p: string) => call<T>("DELETE", p),
};

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
