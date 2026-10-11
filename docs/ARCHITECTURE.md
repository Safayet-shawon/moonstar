# Architecture & decisions

## Assessment of the starting point
The repository was empty, so nothing was reused. Reused instead: the company facts, project references and
five photographs published on moonstarpower.com (the existing site is a PHP site with product pages for
solar, transformer, generator and PFI).

## Stack and why
| Choice | Reason / trade-off |
|---|---|
| **Next.js (frontend) + Express (backend)** in npm workspaces | The brief asks for a long-term application with separate front/back folders. A separate API keeps business rules, secrets and the DB out of the web tier and lets other clients (future public estimator, mobile) reuse them. Cost: two deployables. |
| **`packages/shared`** | One implementation of money/matrix/load/pricing/permission logic used by the server (authoritative) and by the UI (labels, formatting). No duplicated formulas. |
| **PostgreSQL via `pg` + SQL migrations** | Plain SQL, constraints, triggers and indexes visible and reviewable. Supabase is just managed Postgres here: no vendor SDK lock-in, no secrets in the browser. |
| **Own session auth** (not Supabase Auth) | Needs company-defined roles, per-user permission overrides, server-side revocation and audit. Sessions: random 256-bit token, SHA-256 stored, 10 h, HttpOnly cookie. |
| **BigInt money** | `NUMERIC(14,2)` in DB; paisa/milli-unit/basis-point integers in code. Avoids float drift (tested). |
| **PGlite fallback in dev** | Lets the whole stack run with zero setup. It refuses to run in production. |
| **GSAP + lazy three.js** | Reveals/parallax/timeline via GSAP loaded on idle; the three.js grid loads only on ≥900 px screens with motion allowed and pauses off-screen/hidden. |

## Data model (backend/db/migrations/001_init.sql)
`roles · permissions · role_permissions · users · user_permissions(overrides) · sessions · login_attempts ·
areas → housings → projects(+attachments) · product_categories · products · price_history ·
quote_counters · quotations → quotation_versions → quotation_items · approvals · documents ·
work_orders · audit_logs · settings · inquiries`

* **Numbering:** `INSERT … ON CONFLICT DO UPDATE SET n = n + 1 RETURNING` is atomic, with 12 concurrent requests → 12 unique numbers (tested). Format `Q-YYYY-NNN`, year from the Asia/Dhaka date.
* **Snapshots:** each version stores client/project, prepared-by, template/terms, signatory, tech input & result, totals and its items with the **price at the time**. Catalogue changes never touch them.
* **Immutability:** `guard_locked_version/items` triggers; `lockOn` statuses are configurable.
* **Price effective dates:** `price_history` rows with `effective_from`; future rows are applied by `syncScheduledPrices()`.

## Workflow (configurable in Settings → Approval workflow)
`draft → pending_technical → pending_commercial → approved → sent → accepted | rejected`
Returns go back to `draft` with a mandatory note. Each transition names the permission that guards it.
*Revise* (allowed from approved/sent/accepted/rejected) copies the current version into a new draft V(n+1) with a
reason; V(n) stays locked. Work orders attach to the *accepted* quotation (approved version).

## Permissions
32 permission keys (`packages/shared/src/permissions.ts`). Role→permission mapping and per-user grants/denies are
data, editable in *Employees*. Super Admin = all. Guards: only a Super Admin can touch Super Admin accounts; you cannot
grant a permission you do not hold; you cannot demote/deactivate yourself or the last Super Admin.
Cost, margin and pricing formulas never leave the API for users without `quotation.view_cost` / `price.view_cost`; the
public API exposes name/SKU/rating/summary only.

## Engineering engine (informational, not a design approval)
For each load row i: `P_i = kW_i·DF_i`, `Q_i = P_i·tan φ_i` → matrix `D` (n×2). Totals `1ᵀD`, diversity `δ·I₂`,
`S = √(P²+Q²)`, design kVA `= S·(1+expansion)/max loading`, rating = smallest standard ≥ design (or smallest
multi-unit set), PFI kVAR `= P(tan φ₁ − tan φ₂)` rounded up to the configured step, currents `S/(√3·V)`, indicative cable
from a configurable table. Warnings list assumptions and missing information. Output status is always `preliminary`.

## Performance measures (what was done)
Image compression (WebP/AVIF via `next/image`, ≤ 80 KB per photo), lazy loading, code-splitting (GSAP, three.js, portal
client components load on demand), API response caching (public catalogue, calc and report memoisation), CDN/immutable
cache headers, gzip on API and edge, DB indexes on every foreign key and search column, connection pooling, pagination
on all lists, debounced search/filter/calculation inputs, loading skeletons, deferred non-critical scripts, removal of unused
dependencies (framer-motion dropped in favour of one animation library), load balancer in `docker-compose`.
Lighthouse (mobile emulation, local production build): Best Practices 100, SEO 100, Accessibility 98–100, Performance 83–90
(TBT 220–390 ms, CLS 0). Real-world numbers on a CDN are better than local.

## Future: public load estimator
Add `POST /api/public/estimate` in `backend/src/routes/public.ts` calling the same `calculateLoad` with *public* rule
defaults and returning only rating, assumptions and a "preliminary, subject to engineering review" notice, with no
prices, costs, margins or formulas, plus rate limiting and an inquiry hand-off. Separate page under `/(site)/estimator`.
The engine is already isolated in `packages/shared` for this reason.

## Known limitations (honest list)
* No file upload storage: project attachments are `https` links (Supabase Storage can be added behind the same table).
* Docker/nginx files are written but were not executed locally (no Docker on the dev machine).
* PDF uses Helvetica (WinAnsi): the ৳ symbol prints as "BDT". Embedding a TTF (e.g. Noto Sans Bengali/Latin) is a drop-in change in `pdf.ts`.
* Technical-approver *review UI* is the quotation page (technical summary + transition buttons), not a separate queue screen.
* Product images and a real logo file are not uploaded yet (see CONTENT-TODO).
