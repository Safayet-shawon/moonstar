import { PageTitle } from "@/components/portal/ui";
import QuoteBuilder from "@/components/portal/QuoteBuilder";
import { apiGet, requirePerm, safe } from "@/lib/api";
import { DEFAULT_RULES, type EngineeringRules } from "@moonstar/shared";

export const metadata = { title: "New Quotation" };

export default async function Page({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const me = await requirePerm("quotation.create");
  const { project } = await searchParams;
  const { settings } = await apiGet<{ settings: Record<string, unknown> }>("/portal/settings");
  const rules = (settings.engineering_rules as EngineeringRules) ?? DEFAULT_RULES;
  const tpl = (settings.template ?? {}) as { validityDays?: number; paymentTerms?: string };
  const pricing = (settings.pricing ?? {}) as { taxPercent?: number };
  const preset = project ? await safe(apiGet<{ project: never }>(`/portal/projects/${project}`)) : null;
  return (
    <>
      <PageTitle title="New Quotation" sub="Select or create the project, enter the technical requirements, add equipment and review the totals." />
      <QuoteBuilder mode="new" initial={preset ? { project: preset.project } : undefined} perms={me.permissions} rules={rules} defaults={{ validityDays: tpl.validityDays ?? 30, paymentTerms: tpl.paymentTerms ?? "", taxPercent: String(pricing.taxPercent ?? 0) }} />
    </>
  );
}
