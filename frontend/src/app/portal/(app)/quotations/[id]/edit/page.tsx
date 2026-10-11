import { notFound, redirect } from "next/navigation";
import { PageTitle } from "@/components/portal/ui";
import QuoteBuilder, { type BuilderInitial } from "@/components/portal/QuoteBuilder";
import { apiGet, requirePerm, safe } from "@/lib/api";
import { DEFAULT_RULES, type EngineeringRules } from "@moonstar/shared";

export const metadata = { title: "Edit Quotation" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePerm("quotation.edit", "quotation.create");
  const { id } = await params;
  const d = await safe(apiGet<{ quotation: { number: string; status: string; project_id: string; current_version: number }; versions: { version: number; tech_input: Record<string, unknown>; tech_override: BuilderInitial["override"]; commercial: Record<string, unknown> }[]; items: (NonNullable<BuilderInitial["items"]>[number] & { version: number })[]; can: { edit: boolean } }>(`/portal/quotations/${id}`));
  if (!d) notFound();
  if (!d.can.edit) redirect(`/portal/quotations/${id}`);
  const v = d.versions.find((x) => x.version === d.quotation.current_version)!;
  const pr = await apiGet<{ project: never }>(`/portal/projects/${d.quotation.project_id}`);
  const { settings } = await apiGet<{ settings: Record<string, unknown> }>("/portal/settings");
  const rules = (settings.engineering_rules as EngineeringRules) ?? DEFAULT_RULES;
  const tpl = (settings.template ?? {}) as { validityDays?: number; paymentTerms?: string };
  return (
    <>
      <PageTitle title={`Edit ${d.quotation.number} (V${d.quotation.current_version})`} sub="Only drafts can be edited. Approved or sent quotations are preserved and revised as new versions." />
      <QuoteBuilder mode="edit" quotationId={id} initial={{ project: pr.project, techInput: v.tech_input, override: v.tech_override, commercial: v.commercial, items: d.items.filter((i) => i.version === d.quotation.current_version) }} perms={me.permissions} rules={rules} defaults={{ validityDays: tpl.validityDays ?? 30, paymentTerms: tpl.paymentTerms ?? "", taxPercent: "0" }} />
    </>
  );
}
