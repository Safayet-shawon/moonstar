"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api, errMsg } from "@/lib/client";

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await api.post("/auth/login", { email: f.get("email"), password: f.get("password") });
      router.replace("/portal");
      router.refresh();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-navy-950 px-4">
      <div className="grid-lines pointer-events-none absolute inset-0" />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-linear-to-br from-ember-400 to-ember-600 text-white"><Zap className="size-6" fill="currentColor" /></span>
          <div><h1 className="font-display text-xl font-extrabold text-navy-900">Staff Portal</h1><p className="text-sm text-steel-500">Moon Star Power &amp; Technology</p></div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div><label htmlFor="email" className="label">Email</label><input id="email" name="email" type="email" required autoComplete="username" className="field" autoFocus /></div>
          <div><label htmlFor="password" className="label">Password</label><input id="password" name="password" type="password" required autoComplete="current-password" className="field" /></div>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-bad">{error}</p>}
          <Button type="submit" variant="clay" size="lg" className="w-full" disabled={busy}>{busy ? <><Loader2 className="size-4 animate-spin" />Signing in…</> : <><Lock className="size-4" />Sign in</>}</Button>
        </form>
        <p className="mt-6 text-center text-xs text-steel-500">Authorised staff only. Activity is logged. <Link href="/" className="font-semibold text-ember-600">Back to website</Link></p>
      </div>
    </main>
  );
}
