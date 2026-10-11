import { PageTitle } from "@/components/portal/ui";
import ProjectForm from "@/components/portal/ProjectForm";
import { requirePerm } from "@/lib/api";

export const metadata = { title: "New project" };

export default async function Page() {
  await requirePerm("project.create");
  return (
    <>
      <PageTitle title="New project" />
      <div className="card p-5 sm:p-6"><ProjectForm canCreate /></div>
    </>
  );
}
