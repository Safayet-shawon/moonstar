import EmployeesManager from "@/components/portal/EmployeesManager";
import { PageTitle } from "@/components/portal/ui";
import { apiGet, has, requirePerm } from "@/lib/api";

export const metadata = { title: "Employees" };

export default async function Page() {
  const me = await requirePerm("user.manage", "role.manage");
  const canUsers = has(me, "user.manage");
  const [roles, users] = await Promise.all([
    apiGet<{ roles: never[]; permissions: never[] }>("/portal/roles"),
    canUsers ? apiGet<{ users: never[] }>("/portal/users") : Promise.resolve({ users: [] }),
  ]);
  return (
    <>
      <PageTitle title="Employees" sub="Accounts, roles and individual permissions. Every change is recorded in the audit log." />
      <EmployeesManager users={users.users} roles={roles.roles} permissions={roles.permissions} canUsers={canUsers} canRoles={has(me, "role.manage")} me={{ id: me.user.id, role: me.user.role }} />
    </>
  );
}
