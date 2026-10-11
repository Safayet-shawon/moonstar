import Shell from "@/components/portal/Shell";
import { requireMe } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMe();
  return (
    <Shell user={{ name: me.user.name, roleName: me.user.roleName }} permissions={me.permissions}>
      {children}
    </Shell>
  );
}
