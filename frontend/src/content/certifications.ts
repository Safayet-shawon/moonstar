/**
 * Certificates shown on the home page and /certifications.
 *
 * `status: "pending"` entries are PLACEHOLDERS: the company says it holds the certificate but the scan and
 * details have not been supplied yet. They render a neutral "certificate image placeholder" frame (never fake
 * certificate artwork) and "to be provided" for number/validity. To publish a real certificate:
 *   1. save the scan in frontend/public/certs/ (e.g. bsti.webp or bsti.pdf)
 *   2. set `status: "verified"`, `image`, `documentUrl`, `number`, `validity`, `authority`.
 */
export type Certification = {
  name: string;
  authority: string;
  number?: string;
  validity?: string;
  scope: string;
  status: "verified" | "pending";
  image?: string; // e.g. "/certs/bsti.webp"
  documentUrl?: string; // e.g. "/certs/bsti.pdf"
  source: string;
};

export const CERTIFICATIONS: Certification[] = [
  {
    name: "Approved Electrical Substation Manufacturer",
    authority: "Ministry of Power, Energy & Mineral Resources",
    number: "Serial No. 94",
    scope: "Electrical substation manufacturing approval, as stated on the company website.",
    status: "verified",
    source: "moonstarpower.com",
  },
  {
    name: "BSTI Certification",
    authority: "Bangladesh Standards and Testing Institution (BSTI)",
    scope: "Product standards certification held by the company. Scope to be confirmed from the certificate.",
    status: "pending",
    source: "Company statement; document pending",
  },
  {
    name: "ELB Certification",
    authority: "To be confirmed from the certificate",
    scope: "ELB-related certification held by the company. Scope to be confirmed from the certificate.",
    status: "pending",
    source: "Company statement; document pending",
  },
];
