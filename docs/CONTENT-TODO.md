# Content that needs real company input (nothing below is invented)

1. **Certifications.** Only the Ministry of Power, Energy & Mineral Resources approval (Serial No. 94) is published, as
   stated on moonstarpower.com. The company also mentions **BSTI** and **ELB** certificates: send scans plus issuing authority,
   number, scope and validity, then add them to `frontend/src/content/certifications.ts` with a `documentUrl`
   (put PDFs/images in `frontend/public/certs/`). Until verified they are deliberately not shown.
2. **Logo.** The header uses a text wordmark with a bolt icon. The existing logo file on the old site is a 310×60 low-resolution image
   on a black background. Provide a vector/high-resolution logo and replace `Logo()` in `frontend/src/components/site/Header.tsx`
   (and the PDF header in `backend/src/lib/pdf.ts`).
3. **Photographs.** Real photos (from the old site) are used for transformer, generator, solar and substations. The images for
   *HT/LT panels, PFI panels, lifts and maintenance* are **AI-generated photorealistic stand-ins**, labelled "Illustrative image" on
   the pages. Replace `frontend/public/img/{panels,pfi,lift,maintenance}.webp` with your own photographs.
4. **Projects.** The five substations are taken from the old site's client references. Add project photos, and approved client names for any
   others; add entries in `frontend/src/content/projects.ts`.
5. **Products & prices.** The catalogue is empty in production. Demo products (`[DEMO]`, placeholder prices) exist only with `SEED_DEMO=1`.
6. **Quotation terms.** Defaults in `backend/src/db/seed.ts` / Settings are generic. Have the company confirm terms, payment terms, validity and the
   authorised signatory. **No signature image is ever printed**; the PDF shows "Signature pending authorisation" until a signatory is set.
7. **Engineering rules.** Standard ratings, 80 % maximum loading, 20 % expansion, 0.95 target PF and the cable table are sensible defaults.
   An engineer must review them in Settings → Engineering rules.
8. **Statistics.** No numeric claims (years, projects, clients) are shown because none were supplied. Add verified ones when available.
