import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/site/parts";
import { ButtonLink } from "@/components/ui/Button";
import { apiGet } from "@/lib/api";

type P = { id: string; sku: string; name: string; brand: string | null; model: string | null; capacity_kva: string | null; capacity_kvar: string | null; public_summary: string | null; specs: Record<string, unknown>; category_name: string };

async function load(id: string) {
  try {
    return (await apiGet<{ products: P[] }>("/public/products", { revalidate: 300, authed: false })).products.find((p) => p.id === id) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await load((await params).id);
  return p ? { title: p.name, description: p.public_summary ?? undefined } : {};
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const p = await load((await params).id);
  if (!p) notFound();
  const rows: [string, string | null][] = [
    ["Category", p.category_name], ["SKU / code", p.sku], ["Brand", p.brand], ["Model", p.model],
    ["Rating", p.capacity_kva ? `${Number(p.capacity_kva)} kVA` : p.capacity_kvar ? `${Number(p.capacity_kvar)} kVAR` : null],
    ...Object.entries(p.specs ?? {}).map(([k, v]) => [k, String(v)] as [string, string]),
  ];
  return (
    <>
      <PageHero eyebrow={p.category_name} title={p.name} text={p.public_summary ?? undefined} />
      <section className="mx-auto max-w-4xl px-4 py-16">
        <div className="table-wrap">
          <table className="tbl"><tbody>{rows.filter(([, v]) => v).map(([k, v]) => <tr key={k}><th scope="row" className="w-1/3">{k}</th><td>{v}</td></tr>)}</tbody></table>
        </div>
        <p className="mt-4 text-xs text-steel-500">Specifications are indicative and confirmed in the quotation. Pricing is project-specific.</p>
        <ButtonLink href={`/contact?service=${encodeURIComponent(p.category_name)}#quote`} variant="clay" size="lg" className="mt-8">Request a quotation for this product</ButtonLink>
      </section>
    </>
  );
}
