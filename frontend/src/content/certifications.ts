/**
 * Only add an entry here after the document has been verified.
 * `documentUrl` should point to a scan in /public/certs (never invent artwork).
 */
export type Certification = {
  name: string;
  authority: string;
  number?: string;
  validity?: string;
  scope: string;
  documentUrl?: string;
  source: string;
};

export const CERTIFICATIONS: Certification[] = [
  {
    name: "Approved Electrical Substation Manufacturer",
    authority: "Ministry of Power, Energy & Mineral Resources",
    number: "Serial No. 94",
    scope: "Electrical substation manufacturing approval, as stated on the company website.",
    source: "moonstarpower.com",
  },
];

/** Claimed by the company but not yet documented; kept out of the public site until verified. */
export const PENDING_VERIFICATION = ["BSTI certification(s)", "ELB-related certification(s)"];
