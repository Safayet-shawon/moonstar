import ProductManager, { type Product } from "@/components/portal/ProductManager";
import FilterBar from "@/components/portal/FilterBar";
import { Empty, PageTitle, Pagination } from "@/components/portal/ui";
import { apiGet, requirePerm } from "@/lib/api";

export const metadata = { title: "Products & Price Book" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requirePerm("product.view");
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const k of ["q", "category", "active", "page"]) if (sp[k]) qs.set(k, sp[k]!);
  const [d, cats] = await Promise.all([
    apiGet<{ rows: Product[]; total: number; page: number; pages: number; showCost: boolean }>(`/portal/products?${qs}`),
    apiGet<{ categories: { id: number; key: string; name: string }[] }>("/portal/categories"),
  ]);
  return (
    <>
      <PageTitle title="Products & Price Book" sub="Prices live in the database. Changes apply to new quotations; existing quotations keep their original prices." />
      <FilterBar placeholder="Search name, SKU, brand, model…" filters={[{ name: "category", label: "Category", type: "select", options: cats.categories.map((c) => ({ value: c.key, label: c.name })) }, { name: "active", label: "Status", type: "select", options: [{ value: "1", label: "Active" }, { value: "0", label: "Inactive" }] }]} />
      {d.rows.length === 0 && <div className="mb-4"><Empty title="No products found" text="Add products to build the price book." /></div>}
      <ProductManager rows={d.rows} categories={cats.categories} perms={me.permissions} showCost={d.showCost} />
      <Pagination page={d.page} pages={d.pages} total={d.total} base="/portal/products" params={sp} />
    </>
  );
}
