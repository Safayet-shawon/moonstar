import { fromPaisa, toPaisa } from "./money";

export type DiffItem = { sku?: string | null; name: string; qty: string; unit_price: string; line_total: string; unit?: string };

export type ItemChange =
  | { kind: "added"; item: DiffItem }
  | { kind: "removed"; item: DiffItem }
  | { kind: "changed"; before: DiffItem; after: DiffItem; fields: string[] };

const key = (i: DiffItem) => (i.sku ? `sku:${i.sku.toUpperCase()}` : `name:${i.name.trim().toLowerCase()}`);

/** Compare two versions' line items. Keys are SKU (or name for custom items). */
export function diffItems(before: DiffItem[], after: DiffItem[]): ItemChange[] {
  const out: ItemChange[] = [];
  const b = new Map(before.map((i) => [key(i), i]));
  const a = new Map(after.map((i) => [key(i), i]));
  for (const [k, item] of a) {
    const prev = b.get(k);
    if (!prev) {
      out.push({ kind: "added", item });
      continue;
    }
    const fields: string[] = [];
    if (Number(prev.qty) !== Number(item.qty)) fields.push("qty");
    if (toPaisa(prev.unit_price) !== toPaisa(item.unit_price)) fields.push("unit_price");
    if (toPaisa(prev.line_total) !== toPaisa(item.line_total)) fields.push("line_total");
    if (fields.length) out.push({ kind: "changed", before: prev, after: item, fields });
  }
  for (const [k, item] of b) if (!a.has(k)) out.push({ kind: "removed", item });
  return out;
}

export function totalDelta(beforeTotal: string, afterTotal: string) {
  const d = toPaisa(afterTotal) - toPaisa(beforeTotal);
  return { delta: fromPaisa(d), direction: d === 0n ? "same" : d > 0n ? "up" : "down" } as const;
}
