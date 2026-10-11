"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import {
  BarChart3, Boxes, Building2, FilePlus2, FileStack, History, Inbox, LayoutDashboard, LogOut, Menu, MapPinned, Settings, ShieldCheck, Users, X, Zap,
} from "lucide-react";
import { api } from "@/lib/client";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; perms: string[] };

const ITEMS: Item[] = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard, perms: [] },
  { href: "/portal/quotations/new", label: "New Quotation", icon: FilePlus2, perms: ["quotation.create"] },
  { href: "/portal/quotations", label: "All Quotations", icon: FileStack, perms: ["quotation.view_all", "quotation.view_own"] },
  { href: "/portal/revised", label: "Revised Quotations", icon: History, perms: ["quotation.view_all", "quotation.view_own"] },
  { href: "/portal/areas", label: "Areas & Housing", icon: MapPinned, perms: ["project.view"] },
  { href: "/portal/projects", label: "Projects", icon: Building2, perms: ["project.view"] },
  { href: "/portal/products", label: "Products & Price Book", icon: Boxes, perms: ["product.view"] },
  { href: "/portal/reports", label: "Reports", icon: BarChart3, perms: ["report.view"] },
  { href: "/portal/inquiries", label: "Website Enquiries", icon: Inbox, perms: ["inquiry.view"] },
  { href: "/portal/employees", label: "Employees", icon: Users, perms: ["user.manage", "role.manage"] },
  { href: "/portal/audit", label: "Audit Log", icon: ShieldCheck, perms: ["audit.view"] },
  { href: "/portal/settings", label: "Settings", icon: Settings, perms: [] },
];

export default function Shell({ user, permissions, children }: { user: { name: string; roleName: string }; permissions: string[]; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path;
  const setOpen = (v: boolean) => setOpenAt(v ? path : null);
  const items = ITEMS.filter((i) => i.perms.length === 0 || i.perms.some((p) => permissions.includes(p)));
  const active = (h: string) => (h === "/portal" ? path === "/portal" : path === h || (path.startsWith(h + "/") && !items.some((o) => o.href !== h && o.href.startsWith(h + "/") && path.startsWith(o.href))));

  async function signOut() {
    await api.post("/auth/logout").catch(() => {});
    router.replace("/portal/login");
    router.refresh();
  }

  const nav = (
    <nav aria-label="Portal" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={clsx("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors", active(i.href) ? "bg-ember-500/15 text-white ring-1 ring-ember-500/40" : "text-steel-300 hover:bg-white/8 hover:text-white")}>
          <i.icon className={clsx("size-[18px]", active(i.href) && "text-ember-400")} />
          {i.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-navy-950 lg:flex">
        <Link href="/portal" className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
          <span className="grid size-9 place-items-center rounded-lg bg-linear-to-br from-ember-400 to-ember-600 text-white"><Zap className="size-5" fill="currentColor" /></span>
          <span className="font-display leading-tight text-white"><span className="block text-[15px] font-extrabold">MOON STAR</span><span className="block text-[10px] font-semibold tracking-[0.16em] text-steel-300">STAFF PORTAL</span></span>
        </Link>
        {nav}
        <p className="border-t border-white/10 px-5 py-3 text-[11px] text-steel-500">Preliminary engineering outputs require qualified engineer approval.</p>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-black/50" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-navy-950">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-white"><b className="font-display">MOON STAR PORTAL</b><button onClick={() => setOpen(false)} aria-label="Close"><X /></button></div>
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {process.env.NEXT_PUBLIC_DEMO_MODE === "1" && <p className="bg-amber-400 px-4 py-1.5 text-center text-xs font-bold text-navy-950">DEMO MODE: sample data only, shared and reset periodically. Nothing here is real.</p>}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-steel-200 bg-white/90 px-4 backdrop-blur">
          <button className="grid size-10 place-items-center rounded-lg lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}><Menu /></button>
          <Link href="/" target="_blank" className="hidden text-xs font-semibold text-steel-500 hover:text-ember-600 lg:block">View public website ↗</Link>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight"><p className="text-sm font-bold text-navy-900">{user.name}</p><p className="text-[11px] text-steel-500">{user.roleName}</p></div>
            <button onClick={signOut} className="btn btn-fabric-light btn-sm" aria-label="Sign out"><LogOut className="size-4" /><span className="hidden sm:inline">Sign out</span></button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}


