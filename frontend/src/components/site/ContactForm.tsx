"use client";
import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api, errMsg } from "@/lib/client";

const SERVICES = ["Substation", "Transformer", "HT/LT Panel", "PFI Panel", "Diesel Generator", "Solar", "Lift / Elevator", "Maintenance / Service", "Other"];

export default function ContactForm({ defaultService }: { defaultService?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setState("sending");
    const f = new FormData(e.currentTarget);
    try {
      await api.post("/public/inquiry", Object.fromEntries(f.entries()));
      setState("done");
    } catch (err) {
      setError(errMsg(err));
      setState("idle");
    }
  }

  if (state === "done")
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-10 text-center">
        <CheckCircle2 className="size-10 text-ok" />
        <h3 className="text-xl font-bold text-navy-900">Thank you, we have received your request</h3>
        <p className="max-w-sm text-sm text-steel-600">A Moon Star engineer will contact you. For urgent requirements please call our 24/7 support line.</p>
      </div>
    );

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div>
        <label className="label" htmlFor="cf-name">Your name *</label>
        <input id="cf-name" name="name" required minLength={2} autoComplete="name" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="cf-phone">Phone *</label>
        <input id="cf-phone" name="phone" required type="tel" autoComplete="tel" inputMode="tel" className="field" placeholder="+880 1XXX-XXXXXX" />
      </div>
      <div>
        <label className="label" htmlFor="cf-email">Email</label>
        <input id="cf-email" name="email" type="email" autoComplete="email" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="cf-company">Company / project</label>
        <input id="cf-company" name="company" autoComplete="organization" className="field" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="cf-service">I am interested in</label>
        <select id="cf-service" name="service" className="field" defaultValue={defaultService ?? ""}>
          <option value="">Select a solution</option>
          {SERVICES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="cf-msg">Project details *</label>
        <textarea id="cf-msg" name="message" required minLength={10} className="field" placeholder="Location, approximate load (kW), equipment needed, timeline" />
      </div>
      {/* honeypot: hidden from people, irresistible to bots */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {error && <p role="alert" className="sm:col-span-2 text-sm font-semibold text-bad">{error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" variant="clay" size="lg" disabled={state === "sending"}>
          {state === "sending" ? <><Loader2 className="size-4 animate-spin" /> Sending…</> : "Request a Consultation"}
        </Button>
        <p className="mt-3 text-xs text-steel-500">We use your details only to respond to this request.</p>
      </div>
    </form>
  );
}
