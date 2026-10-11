import { PageTitle } from "@/components/portal/ui";
import QuotationList from "@/components/portal/QuotationList";
import { requirePerm } from "@/lib/api";

export const metadata = { title: "Revised Quotations" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("quotation.view_all", "quotation.view_own");
  return (
    <>
      <PageTitle title="Revised Quotations" sub="Quotations with two or more versions. Open one to compare versions and download earlier PDFs." />
      <QuotationList sp={await searchParams} revisedOnly base="/portal/revised" />
    </>
  );
}
