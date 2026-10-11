"use client";
import { useMemo, useState } from "react";
import type { PortfolioProject } from "@/content/projects";

const BANDS = [
  { key: "all", label: "All", test: () => true },
  { key: "s", label: "Up to 250 kVA", test: (p: PortfolioProject) => p.capacityKva <= 250 },
  { key: "m", label: "251 – 500 kVA", test: (p: PortfolioProject) => p.capacityKva > 250 && p.capacityKva <= 500 },
  { key: "l", label: "Above 500 kVA", test: (p: PortfolioProject) => p.capacityKva > 500 },
];

export default function ProjectGrid({ projects }: { projects: PortfolioProject[] }) {
  const [band, setBand] = useState("all");
  const shown = useMemo(() => projects.filter(BANDS.find((b) => b.key === band)!.test), [projects, band]);
  return (
    <>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter projects by capacity">
        {BANDS.map((b) => (
          <button key={b.key} onClick={() => setBand(b.key)} aria-pressed={band === b.key} className={`btn btn-sm ${band === b.key ? "btn-clay-navy" : "btn-ghost"}`}>{b.label}</button>
        ))}
      </div>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p) => (
          <article key={p.name} className="card p-6 transition-shadow hover:shadow-lg">
            <p className="font-display text-5xl font-extrabold text-navy-900">{p.capacityKva}<span className="ml-1 text-lg font-bold text-ember-600">kVA</span></p>
            <h3 className="mt-3 text-lg font-bold text-navy-900">{p.name}</h3>
            <dl className="mt-3 space-y-1 text-sm text-steel-600">
              <div className="flex gap-2"><dt className="font-semibold text-navy-800">Location</dt><dd>{p.location}</dd></div>
              <div className="flex gap-2"><dt className="font-semibold text-navy-800">Scope</dt><dd>{p.scope}</dd></div>
            </dl>
            <p className="mt-4 inline-block rounded bg-steel-100 px-2 py-1 text-xs font-bold uppercase tracking-wide text-steel-600">{p.type}</p>
          </article>
        ))}
      </div>
      {shown.length === 0 && <p className="mt-8 text-steel-600">No projects in this range yet.</p>}
    </>
  );
}
