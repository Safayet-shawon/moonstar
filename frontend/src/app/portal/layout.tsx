import type { Metadata } from "next";

export const metadata: Metadata = { title: { default: "Staff Portal", template: "%s | Moon Star Portal" }, robots: { index: false, follow: false } };

export default function PortalRoot({ children }: { children: React.ReactNode }) {
  return children;
}
