"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api, errMsg } from "@/lib/client";
import { DT, Notice } from "./ui";

type User = { id: string; email: string; name: string; phone: string | null; designation: string | null; active: boolean; is_signatory: boolean; signatory_title: string | null; role: string; role_name: string; last_login: string | null };
type Role = { id: number; key: string; name: string; description: string | null; permissions: string[] };
type Perm = { key: string; group: string; description: string };

export default function EmployeesManager({ users, roles, permissions, canUsers, canRoles, me }: { users: User[]; roles: Role[]; permissions: Perm[]; canUsers: boolean; canRoles: boolean; me: { id: string; role: string } }) {
  const router = useRouter();
  const [tab, setTab] = useState<"users" | "roles">("users");
  const [form, setForm] = useState<User | "new" | null>(null);
  const [overrideFor, setOverrideFor] = useState<{ user: User; map: Record<string, boolean | null> } | null>(null);
  const [roleKey, setRoleKey] = useState(roles.find((r) => r.key !== "super_admin")?.key ?? roles[0].key);
  const [rolePerms, setRolePerms] = useState<Set<string>>(new Set(roles.find((r) => r.key === roleKey)?.permissions));
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try { await fn(); setMsg({ tone: "ok", text: ok }); router.refresh(); return true; } catch (e) { setMsg({ tone: "bad", text: errMsg(e) }); return false; }
  };
  const assignable = roles.filter((r) => r.key !== "super_admin" || me.role === "super_admin");

  async function saveUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) ?? "");
    const body = { email: g("email"), name: g("name"), phone: g("phone") || null, designation: g("designation") || null, role: g("role"), active: f.get("active") === "on", isSignatory: f.get("isSignatory") === "on", signatoryTitle: g("signatoryTitle") || null, ...(form === "new" ? { password: g("password") } : {}) };
    const ok = await run(() => (form === "new" ? api.post("/portal/users", body) : api.put(`/portal/users/${(form as User).id}`, body)), "Saved.");
    if (ok) setForm(null);
  }

  async function openOverrides(u: User) {
    const r = await api.get<{ overrides: { perm_key: string; granted: boolean }[] }>(`/portal/users/${u.id}/permissions`);
    setOverrideFor({ user: u, map: Object.fromEntries(r.overrides.map((o) => [o.perm_key, o.granted])) });
  }

  const roleBase = (u: User) => new Set(roles.find((r) => r.key === u.role)?.permissions);
  const groups = [...new Set(permissions.map((p) => p.group))];
  const u = form && form !== "new" ? form : null;

  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="tablist">
        {canUsers && <button role="tab" aria-selected={tab === "users"} className={`btn btn-sm ${tab === "users" ? "btn-clay-navy" : "btn-ghost"}`} onClick={() => setTab("users")}>Employees</button>}
        {canRoles && <button role="tab" aria-selected={tab === "roles"} className={`btn btn-sm ${tab === "roles" ? "btn-clay-navy" : "btn-ghost"}`} onClick={() => setTab("roles")}>Roles &amp; permissions</button>}
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      {tab === "users" && canUsers && (
        <>
          {!form && <Button variant="clay" onClick={() => setForm("new")}><Plus className="size-4" />Add employee</Button>}
          {form && (
            <form onSubmit={saveUser} className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <h2 className="font-bold text-forest-900 sm:col-span-2 lg:col-span-3">{form === "new" ? "New employee" : `Edit ${u!.name}`}</h2>
              <div><label className="label" htmlFor="u-name">Full name *</label><input id="u-name" name="name" required className="field" defaultValue={u?.name} /></div>
              <div><label className="label" htmlFor="u-email">Email *</label><input id="u-email" name="email" type="email" required className="field" defaultValue={u?.email} /></div>
              <div><label className="label" htmlFor="u-role">Role *</label><select id="u-role" name="role" className="field" defaultValue={u?.role ?? "employee"}>{assignable.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select></div>
              <div><label className="label" htmlFor="u-phone">Phone</label><input id="u-phone" name="phone" className="field" defaultValue={u?.phone ?? ""} /></div>
              <div><label className="label" htmlFor="u-des">Designation</label><input id="u-des" name="designation" className="field" defaultValue={u?.designation ?? ""} /></div>
              {form === "new" && <div><label className="label" htmlFor="u-pw">Initial password *</label><input id="u-pw" name="password" type="text" required minLength={10} autoComplete="off" className="field" placeholder="min 10 chars, upper+lower+digit" /><p className="mt-1 text-xs text-steel-500">User must change it at first login.</p></div>}
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="active" className="size-4 accent-brand-500" defaultChecked={u?.active ?? true} />Active</label>
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="isSignatory" className="size-4 accent-brand-500" defaultChecked={u?.is_signatory} />Authorised signatory (appears as signatory on PDFs)</label>
              <div><label className="label" htmlFor="u-st">Signatory title</label><input id="u-st" name="signatoryTitle" className="field" defaultValue={u?.signatory_title ?? ""} /></div>
              <div className="flex gap-2 sm:col-span-2 lg:col-span-3"><Button type="submit" variant="clay">Save</Button><Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button></div>
            </form>
          )}
          <div className="table-wrap"><table className="tbl"><thead><tr><th>Name</th><th>Role</th><th>Designation</th><th>Status</th><th>Last sign-in</th><th /></tr></thead><tbody>
            {users.map((x) => (
              <tr key={x.id} className={x.active ? "" : "opacity-60"}>
                <td><b className="text-forest-900">{x.name}</b><p className="text-xs text-steel-500">{x.email}</p></td><td>{x.role_name}</td><td>{x.designation ?? "—"}{x.is_signatory && <span className="badge badge-approved ml-1">Signatory</span>}</td>
                <td>{x.active ? <span className="badge badge-accepted">Active</span> : <span className="badge badge-draft">Disabled</span>}</td><td className="text-xs">{x.last_login ? <DT v={x.last_login} /> : "never"}</td>
                <td className="whitespace-nowrap">
                  <button className="btn btn-ghost btn-sm" aria-label={`Edit ${x.name}`} onClick={() => setForm(x)}><Pencil className="size-3.5" /></button>
                  <button className="btn btn-ghost btn-sm ml-1" aria-label={`Reset password for ${x.name}`} onClick={() => { const p = window.prompt(`New temporary password for ${x.name} (min 10 chars, upper+lower+digit)`); if (p) run(() => api.post(`/portal/users/${x.id}/reset-password`, { password: p }), "Password reset. The user must change it at next login."); }}><KeyRound className="size-3.5" /></button>
                  {canRoles && <button className="btn btn-ghost btn-sm ml-1" aria-label={`Permissions for ${x.name}`} onClick={() => openOverrides(x)}><ShieldCheck className="size-3.5" /></button>}
                </td>
              </tr>))}
          </tbody></table></div>
        </>
      )}

      {overrideFor && (
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-forest-900">Individual permissions · {overrideFor.user.name} <span className="font-normal text-steel-500">({overrideFor.user.role_name})</span></h2><button className="text-sm font-bold text-brand-600" onClick={() => setOverrideFor(null)}>Close</button></div>
          <p className="mb-3 text-xs text-steel-500">“Inherit” follows the role. Grant or deny to override for this person only. You can only grant permissions you hold yourself.</p>
          {groups.map((g) => (
            <fieldset key={g} className="mb-4"><legend className="mb-1 text-xs font-bold uppercase tracking-wider text-steel-500">{g}</legend>
              <div className="grid gap-1.5 sm:grid-cols-2">{permissions.filter((p) => p.group === g).map((p) => {
                const cur = overrideFor.map[p.key]; const base = roleBase(overrideFor.user).has(p.key);
                return (<label key={p.key} className="flex items-center justify-between gap-2 rounded border border-steel-100 px-3 py-1.5 text-sm"><span>{p.description}<span className="ml-1 text-[11px] text-steel-500">{base ? "· role grants" : ""}</span></span>
                  <select aria-label={p.key} className="field min-h-8 w-28 py-0.5 text-xs" value={cur === undefined || cur === null ? "inherit" : cur ? "grant" : "deny"} onChange={(e) => setOverrideFor({ ...overrideFor, map: { ...overrideFor.map, [p.key]: e.target.value === "inherit" ? null : e.target.value === "grant" } })}><option value="inherit">Inherit</option><option value="grant">Grant</option><option value="deny">Deny</option></select></label>);
              })}</div></fieldset>
          ))}
          <Button variant="clay" onClick={async () => { if (await run(() => api.put(`/portal/users/${overrideFor.user.id}/permissions`, { overrides: overrideFor.map }), "Permissions updated.")) setOverrideFor(null); }}>Save permissions</Button>
        </div>
      )}

      {tab === "roles" && canRoles && (
        <div className="card p-5">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div><label className="label" htmlFor="role-sel">Role</label><select id="role-sel" className="field" value={roleKey} onChange={(e) => { setRoleKey(e.target.value); setRolePerms(new Set(roles.find((r) => r.key === e.target.value)?.permissions)); }}>{roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select></div>
            <p className="text-sm text-steel-600">{roles.find((r) => r.key === roleKey)?.description}</p>
          </div>
          {roleKey === "super_admin" ? <Notice>Super Admin always holds every permission and cannot be restricted.</Notice> : (
            <>
              {groups.map((g) => (
                <fieldset key={g} className="mb-4"><legend className="mb-1 text-xs font-bold uppercase tracking-wider text-steel-500">{g}</legend>
                  <div className="grid gap-1.5 sm:grid-cols-2">{permissions.filter((p) => p.group === g).map((p) => (
                    <label key={p.key} className="flex items-center gap-2 rounded border border-steel-100 px-3 py-1.5 text-sm"><input type="checkbox" className="size-4 accent-brand-500" checked={rolePerms.has(p.key)} onChange={(e) => setRolePerms((s) => { const n = new Set(s); if (e.target.checked) n.add(p.key); else n.delete(p.key); return n; })} />{p.description}</label>
                  ))}</div></fieldset>
              ))}
              <Button variant="clay" onClick={() => run(() => api.put(`/portal/roles/${roleKey}/permissions`, { permissions: [...rolePerms] }), "Role permissions updated.")}>Save role permissions</Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
