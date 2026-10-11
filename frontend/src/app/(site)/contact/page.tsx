import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { COMPANY } from "@moonstar/shared";
import { PageHero } from "@/components/site/parts";
import ContactForm from "@/components/site/ContactForm";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Contact Us", description: "Request a quotation or technical consultation from Moon Star Power & Technology." };

export default async function Contact({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const { service } = await searchParams;
  const map = [
    ["Factory", COMPANY.factory],
    ["Branch office", COMPANY.branch],
    ["Khulna office", COMPANY.khulna],
  ];
  return (
    <>
      <PageHero eyebrow="Contact us" title="Request a quotation or consultation" text="Share a few details and an engineer will get back to you. For urgent faults, call our 24/7 support line." />
      <section id="quote" className="mx-auto grid max-w-7xl gap-12 px-4 py-16 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <div className="flex gap-3"><Phone className="mt-1 size-5 text-ember-500" /><div><p className="font-bold text-navy-900">24/7 support line</p><a href={COMPANY.phoneHref} className="text-steel-600 hover:text-ember-600">{COMPANY.phone}</a></div></div>
          <div className="flex gap-3"><Mail className="mt-1 size-5 text-ember-500" /><div><p className="font-bold text-navy-900">Email</p><a href={`mailto:${COMPANY.email}`} className="text-steel-600 hover:text-ember-600">{COMPANY.email}</a></div></div>
          <div className="flex gap-3"><Clock className="mt-1 size-5 text-ember-500" /><div><p className="font-bold text-navy-900">Office hours</p><p className="text-steel-600">{COMPANY.hours}</p></div></div>
          {map.map(([t, a]) => (
            <div key={t} className="flex gap-3"><MapPin className="mt-1 size-5 text-ember-500" /><div><p className="font-bold text-navy-900">{t}</p><p className="text-sm text-steel-600">{a}</p></div></div>
          ))}
          <ButtonLink href={COMPANY.mapUrl} target="_blank" rel="noopener noreferrer" variant="fabric-light" size="sm">Open factory location in Maps</ButtonLink>
        </div>
        <div className="card p-6 sm:p-8 lg:col-span-3"><ContactForm defaultService={service} /></div>
      </section>
    </>
  );
}
