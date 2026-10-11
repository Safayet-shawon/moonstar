import SettingsPanel from "@/components/portal/SettingsPanel";
import { PageTitle } from "@/components/portal/ui";
import { apiGet, requireMe } from "@/lib/api";

export const metadata = { title: "Settings" };

export default async function Page() {
  const me = await requireMe();
  const canAdmin = me.permissions.some((p) => p === "settings.manage" || p === "template.manage");
  const settings = canAdmin ? (await apiGet<{ settings: Record<string, unknown> }>("/portal/settings")).settings : {};
  return (
    <>
      <PageTitle title="Settings" sub="Company details, quotation template, workflow and engineering rules are editable without code changes." />
      <SettingsPanel settings={settings} perms={me.permissions} />
    </>
  );
}
