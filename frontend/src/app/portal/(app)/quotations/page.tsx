import { FilePlus2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { PageTitle } from "@/components/portal/ui";
import QuotationList from "@/components/portal/QuotationList";
import { getMe, requirePerm } from "@/lib/api";

export const metadata = { title: "All Quotations" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("quotation.view_all", "quotation.view_own");
  const me = await getMe();
  return (
    <>
      <PageTitle title="All Quotations" sub="Search by project, area, housing, client, employee, quotation number, status or date." actions={me?.permissions.includes("quotation.create") && <ButtonLink href="/portal/quotations/new" variant="clay"><FilePlus2 className="size-4" />New Quotation</ButtonLink>} />
      <QuotationList sp={await searchParams} base="/portal/quotations" />
    </>
  );
}
