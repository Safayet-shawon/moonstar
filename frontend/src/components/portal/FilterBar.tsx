"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

export type FilterDef = { name: string; label: string; type: "select" | "date"; options?: { value: string; label: string }[] };

/** URL-driven filters: search input is debounced; changing any filter resets to page 1. */
export default function FilterBar({ filters = [], placeholder = "Search…", searchName = "q", hideSearch = false }: { filters?: FilterDef[]; placeholder?: string; searchName?: string; hideSearch?: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get(searchName) ?? "");
  const first = useRef(true);

  const push = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) { if (v) p.set(k, v); else p.delete(k); }
    p.delete("page");
    router.replace(`${path}?${p}`);
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => push({ [searchName]: q.trim() || null }), 350); // debounce keystrokes
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = [...sp.keys()].some((k) => k !== "page");
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className={"relative min-w-60 flex-1 " + (hideSearch ? "hidden" : "")}>
        <label htmlFor="fb-q" className="label">Search</label>
        <Search className="pointer-events-none absolute bottom-3 left-3 size-4 text-steel-500" />
        <input id="fb-q" className="field pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} type="search" />
      </div>
      {filters.map((f) => (
        <div key={f.name}>
          <label htmlFor={`fb-${f.name}`} className="label">{f.label}</label>
          {f.type === "select" ? (
            <select id={`fb-${f.name}`} className="field" value={sp.get(f.name) ?? ""} onChange={(e) => push({ [f.name]: e.target.value || null })}>
              <option value="">All</option>
              {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input id={`fb-${f.name}`} className="field" type="date" value={sp.get(f.name) ?? ""} onChange={(e) => push({ [f.name]: e.target.value || null })} />
          )}
        </div>
      ))}
      {active && (
        <button className="btn btn-ghost btn-sm mb-0.5" onClick={() => { setQ(""); router.replace(path); }}><X className="size-4" />Clear</button>
      )}
    </div>
  );
}
