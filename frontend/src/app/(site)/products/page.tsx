import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/parts";
import { ButtonLink } from "@/components/ui/Button";
import { apiGet } from "@/lib/api";

export const metadata: Metadata = { title: "Product Catalogue", description: "Transformers, panels, PFI, generators and more supplied by Moon Star Power & Technology." };

type P = { id: string; sku: string; name: string; brand: string | null; model: string | null; capacity_kva: string | null; capacity_kvar: string | null; public_summary: string | null; category_key: string; category_name: string };

export default async function Products() {
  let products: P[] = [];
  let failed = false;
  try {
    products = (await apiGet<{ products: P[] }>("/public/products", { revalidate: 300, authed: false })).products;
  } catch {
    failed = true;
  }
  const groups = [...new Set(products.map((p) => p.category_name))];
  return (
    <>
      <PageHero eyebrow="Product catalogue" title="Equipment we supply" text="Ratings and specifications are confirmed per project. Contact us for availability and a quotation." image="/img/transformer.webp" />
      <section className="mx-auto max-w-7xl px-4 py-16">
        {failed && <p role="alert" className="rounded-lg bg-amber-50 p-4 text-sm text-warn">The catalogue is temporarily unavailable. Please call {"+880 1911-284405"}.</p>}
        {!failed && products.length === 0 && (
          <div className="card mx-auto max-w-xl p-10 text-center">
            <h2 className="text-xl font-bold text-navy-900">Catalogue being published</h2>
            <p className="mt-2 text-sm text-steel-600">Our product catalogue is being prepared. Tell us what you need and we will send specifications and a quotation.</p>
            <ButtonLink href="/contact#quote" variant="clay" className="mt-6">Request a quotation</ButtonLink>
          </div>
        )}
        {groups.map((g) => (
          <div key={g} className="mb-12">
            <h2 className="mb-5 text-2xl font-bold text-navy-900">{g}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.filter((p) => p.category_name === g).map((p) => (
                <Link key={p.id} href={`/products/${p.id}`} className="card block p-5 transition-all hover:-translate-y-0.5 hover:border-ember-400 hover:shadow-md">
                  <p className="text-xs font-bold uppercase tracking-wider text-steel-500">{p.sku}</p>
                  <h3 className="mt-1 font-bold text-navy-900">{p.name}</h3>
                  {(p.capacity_kva || p.capacity_kvar) && <p className="mt-2 text-sm font-semibold text-ember-600">{p.capacity_kva ? `${Number(p.capacity_kva)} kVA` : `${Number(p.capacity_kvar)} kVAR`}</p>}
                  {p.public_summary && <p className="mt-2 line-clamp-2 text-sm text-steel-600">{p.public_summary}</p>}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
