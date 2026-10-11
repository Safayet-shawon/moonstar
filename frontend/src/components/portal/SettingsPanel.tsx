"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api, errMsg } from "@/lib/client";
import { Notice } from "./ui";

type S = Record<string, unknown>;
const TABS = [
  { key: "company", label: "Company", perm: "settings.manage" },
  { key: "template", label: "Quotation template", perm: "template.manage" },
  { key: "pricing", label: "Tax & pricing", perm: "settings.manage" },
  { key: "workflow", label: "Approval workflow", perm: "settings.manage" },
  { key: "engineering_rules", label: "Engineering rules", perm: "settings.manage" },
  { key: "password", label: "My password", perm: "" },
];

function useSave(key: string) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return {
    msg, busy,
    save: async (value: unknown) => {
      setBusy(true); setMsg(null);
      try { await api.put(`/portal/settings/${key}`, value); setMsg({ tone: "ok", text: "Saved." }); router.refresh(); } catch (e) { setMsg({ tone: "bad", text: errMsg(e) }); } finally { setBusy(false); }
    },
  };
}

function Field({ label, name, value, textarea, type = "text" }: { label: string; name: string; value: unknown; textarea?: boolean; type?: string }) {
  return (<div><label className="label" htmlFor={`s-${name}`}>{label}</label>{textarea ? <textarea id={`s-${name}`} name={name} className="field" defaultValue={String(value ?? "")} /> : <input id={`s-${name}`} name={name} type={type} className="field" defaultValue={String(value ?? "")} />}</div>);
}

function Company({ v }: { v: S }) {
  const { save, msg, busy } = useSave("company");
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget).entries()); save(f); }}>
      <Field label="Company name" name="name" value={v.name} /><Field label="Tagline" name="tagline" value={v.tagline} />
      <Field label="Phone" name="phone" value={v.phone} /><Field label="Email" name="email" value={v.email} /><Field label="Website" name="website" value={v.website} /><Field label="Business hours" name="hours" value={v.hours} />
      <Field label="Factory address" name="factory" value={v.factory} textarea /><Field label="Branch office" name="branch" value={v.branch} textarea /><Field label="Khulna office" name="khulna" value={v.khulna} textarea />
      <Field label="Government approval statement" name="approval" value={v.approval} textarea />
      <Field label="Business timezone (IANA)" name="timezone" value={v.timezone} /><Field label="Currency" name="currency" value={v.currency} />
      <div className="sm:col-span-2"><Button type="submit" variant="clay" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />}Save company details</Button>{msg && <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}</div>
    </form>
  );
}

function Template({ v }: { v: S }) {
  const { save, msg, busy } = useSave("template");
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); save({ header: f.get("header"), footer: f.get("footer"), validityDays: Number(f.get("validityDays")), quotePrefix: f.get("quotePrefix"), paymentTerms: f.get("paymentTerms"), terms: String(f.get("terms") ?? "").split("\n").map((s) => s.trim()).filter(Boolean), signatoryName: f.get("signatoryName"), signatoryTitle: f.get("signatoryTitle"), showSignatureBlock: f.get("showSignatureBlock") === "on" }); }}>
      <Field label="Quotation header line" name="header" value={v.header} /><Field label="Footer text" name="footer" value={v.footer} />
      <Field label="Validity (days)" name="validityDays" value={v.validityDays} type="number" /><Field label="Number prefix (e.g. Q → Q-2026-001)" name="quotePrefix" value={v.quotePrefix} />
      <div className="sm:col-span-2"><Field label="Payment terms" name="paymentTerms" value={v.paymentTerms} textarea /></div>
      <div className="sm:col-span-2"><Field label="Terms & conditions (one per line)" name="terms" value={((v.terms as string[]) ?? []).join("\n")} textarea /></div>
      <Field label="Default authorised signatory name" name="signatoryName" value={v.signatoryName} /><Field label="Signatory title" name="signatoryTitle" value={v.signatoryTitle} />
      <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2"><input type="checkbox" name="showSignatureBlock" className="size-4 accent-ember-500" defaultChecked={v.showSignatureBlock as boolean} />Show signatory block on the PDF</label>
      <p className="text-xs text-steel-500 sm:col-span-2">A signatory name is printed as authorised only if it is set here or the preparing user is flagged as an authorised signatory. No signature image is added automatically.</p>
      <div className="sm:col-span-2"><Button type="submit" variant="clay" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />}Save template</Button>{msg && <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}</div>
    </form>
  );
}

function Pricing({ v }: { v: S }) {
  const { save, msg, busy } = useSave("pricing");
  return (
    <form className="grid gap-4 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); save({ taxPercent: Number(f.get("taxPercent")), taxLabel: f.get("taxLabel"), defaultMarkupPercent: Number(f.get("defaultMarkupPercent")) }); }}>
      <Field label="Default tax / VAT (%)" name="taxPercent" value={v.taxPercent} type="number" /><Field label="Tax label on PDF" name="taxLabel" value={v.taxLabel} /><Field label="Default markup (%)" name="defaultMarkupPercent" value={v.defaultMarkupPercent} type="number" />
      <div className="sm:col-span-3"><Button type="submit" variant="clay" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />}Save</Button>{msg && <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}</div>
    </form>
  );
}

function Json({ k, v, help }: { k: string; v: S; help: string }) {
  const { save, msg, busy } = useSave(k);
  const [text, setText] = useState(JSON.stringify(v, null, 2));
  const [parseErr, setParseErr] = useState("");
  return (
    <div className="space-y-3">
      <p className="text-sm text-steel-600">{help}</p>
      <textarea aria-label={k} className="field min-h-96 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      {parseErr && <Notice tone="bad">{parseErr}</Notice>}
      <Button variant="clay" disabled={busy} onClick={() => { try { const parsed = JSON.parse(text); setParseErr(""); save(parsed); } catch { setParseErr("Invalid JSON"); } }}>{busy && <Loader2 className="size-4 animate-spin" />}Validate &amp; save</Button>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </div>
  );
}

function Password() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  return (
    <form className="grid max-w-md gap-4" onSubmit={async (e) => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); setMsg(null); if (f.get("next") !== f.get("again")) return setMsg({ tone: "bad", text: "New passwords do not match." }); try { await api.post("/auth/password", { current: f.get("current"), next: f.get("next") }); setMsg({ tone: "ok", text: "Password changed." }); form.reset(); router.refresh(); } catch (x) { setMsg({ tone: "bad", text: errMsg(x) }); } }}>
      <div><label className="label" htmlFor="pw-c">Current password</label><input id="pw-c" name="current" type="password" required autoComplete="current-password" className="field" /></div>
      <div><label className="label" htmlFor="pw-n">New password</label><input id="pw-n" name="next" type="password" required minLength={10} autoComplete="new-password" className="field" /></div>
      <div><label className="label" htmlFor="pw-a">Repeat new password</label><input id="pw-a" name="again" type="password" required autoComplete="new-password" className="field" /></div>
      <Button type="submit" variant="clay">Change password</Button>{msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </form>
  );
}

export default function SettingsPanel({ settings, perms }: { settings: S; perms: string[] }) {
  const tabs = TABS.filter((t) => !t.perm || perms.includes(t.perm));
  const [tab, setTab] = useState(tabs[0].key);
  const v = (k: string) => (settings[k] ?? {}) as S;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist">{tabs.map((t) => <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={`btn btn-sm ${tab === t.key ? "btn-clay-navy" : "btn-ghost"}`}>{t.label}</button>)}</div>
      <div className="card p-5 sm:p-6">
        {tab === "company" && <Company v={v("company")} />}
        {tab === "template" && <Template v={v("template")} />}
        {tab === "pricing" && <Pricing v={v("pricing")} />}
        {tab === "workflow" && <Json k="workflow" v={v("workflow")} help="Each status lists the transitions allowed from it and the permission required. Statuses: draft, pending_technical, pending_commercial, approved, sent, accepted, rejected. 'lockOn' lists statuses at which a version becomes immutable." />}
        {tab === "engineering_rules" && <Json k="engineering_rules" v={v("engineering_rules")} help="Approved engineering assumptions used by the preliminary sizing engine: standard ratings, maximum loading, expansion margin, cable table and load-category defaults. Have a qualified engineer review changes." />}
        {tab === "password" && <Password />}
      </div>
    </div>
  );
}
