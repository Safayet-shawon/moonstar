import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap", weight: ["600", "700", "800"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.moonstarpower.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Moon Star Power & Technology | Substations, Transformers, Panels, Generators & Solar", template: "%s | Moon Star Power & Technology" },
  description:
    "Electrical substations, transformers, HT/LT panels, PFI panels, diesel generators, solar and lift solutions across Bangladesh. Supply, installation, testing, commissioning and 24/7 maintenance.",
  openGraph: { type: "website", siteName: "Moon Star Power & Technology", locale: "en_BD", images: ["/img/hero-transformer.webp"] },
  robots: process.env.NEXT_PUBLIC_DEMO_MODE === "1" ? { index: false, follow: false } : { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#0b1f3a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <head>
        {/* progressive enhancement: reveal animations only hide content when JS is running and motion is allowed */}
        <script dangerouslySetInnerHTML={{ __html: "if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('js')" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
