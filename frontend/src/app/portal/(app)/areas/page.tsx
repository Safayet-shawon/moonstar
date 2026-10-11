import { PageTitle } from "@/components/portal/ui";
import AreasManager from "@/components/portal/AreasManager";
import { apiGet, has, requirePerm } from "@/lib/api";

export const metadata = { title: "Areas & Housing" };

export default async function Page() {
  const me = await requirePerm("project.view");
  const [a, h] = await Promise.all([apiGet<{ areas: never[] }>("/portal/areas"), apiGet<{ housings: never[] }>("/portal/housings")]);
  return (
    <>
      <PageTitle title="Areas & Housing" sub="Area → Housing → Project. Reuse locations instead of retyping them on every quotation." />
      <AreasManager areas={a.areas} housings={h.housings} canCreate={has(me, "project.create")} canEdit={has(me, "project.edit")} />
    </>
  );
}
