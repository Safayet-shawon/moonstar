import type { Metadata } from "next";
import { PageHero } from "@/components/site/parts";
import ProjectGrid from "@/components/site/ProjectGrid";
import { ButtonLink } from "@/components/ui/Button";
import { PROJECTS } from "@/content/projects";

export const metadata: Metadata = { title: "Projects", description: "Substation projects delivered by Moon Star Power & Technology in Dhaka." };

export default function Projects() {
  return (
    <>
      <PageHero eyebrow="Projects & case studies" title="Substations powering Dhaka's buildings" text="A selection of projects from our client references. Project photographs and detailed case studies are published with client approval." image="/img/substation-2.webp" />
      <section className="mx-auto max-w-7xl px-4 py-16">
        <ProjectGrid projects={PROJECTS} />
        <div className="mt-14 rounded-xl bg-paper p-8 text-center">
          <h2 className="text-xl font-bold text-navy-900">Planning a substation?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-steel-600">Tell us about your building and we will propose the right capacity and equipment.</p>
          <ButtonLink href="/contact#quote" variant="clay" className="mt-5">Request a quotation</ButtonLink>
        </div>
      </section>
    </>
  );
}
