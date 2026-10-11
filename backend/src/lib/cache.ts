/** Tiny in-process TTL cache for expensive, idempotent results (reports, engineering calculations, public catalogue). */
const store = new Map<string, { v: unknown; exp: number }>();
const MAX = 500;

export async function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  const now = Date.now();
  if (hit && hit.exp > now) return hit.v as T;
  const v = await fn();
  if (store.size >= MAX) {
    for (const [k, e] of store) if (e.exp <= now) store.delete(k);
    if (store.size >= MAX) store.delete(store.keys().next().value as string);
  }
  store.set(key, { v, exp: now + ttlMs });
  return v;
}

export function invalidate(prefix: string) {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
