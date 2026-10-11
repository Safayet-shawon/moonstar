# Moon Star Power & Technology: website, staff portal and quotation platform

A premium corporate website plus a private, role-based quotation and project-management portal for
**Moon Star Power & Technology** (substations, transformers, HT/LT & PFI panels, generators, solar, lifts).

```
moonstar/
├─ frontend/         Next.js 16 (App Router) — public website + /portal UI.   own package.json
├─ backend/          Express 5 API — auth, RBAC, projects, pricing, quotations,
│                    PDF, reports, audit. PostgreSQL/Supabase.                  own package.json
│  ├─ db/migrations  SQL schema (versioned)
│  ├─ src/lib        business services     src/routes  HTTP layer
│  └─ tests          unit + integration + HTTP tests (54)
├─ packages/shared/  Pure TypeScript used by both: money (BigInt), matrix maths,
│                    load-sizing engine, pricing engine, permissions catalogue. own package.json
├─ nginx/ + docker-compose.yml   load balancer + replicas
├─ docs/             ARCHITECTURE · DEPLOYMENT · BACKUP-RECOVERY · CONTENT-TODO
└─ package.json      npm workspaces: one install, one set of scripts for everything
```

The browser only talks to the frontend origin. `/api/*` is proxied to the backend, so the session
cookie is first-party, `HttpOnly`, `SameSite=Lax` and never readable from JavaScript.

## Quick start (no accounts needed)

```bash
npm install
cp .env.example .env            # optional locally
npm run db:seed:demo            # embedded Postgres (PGlite) in backend/.data + demo users/products
npm run dev                     # api :4000 + web :3000
```

Open http://localhost:3000 (website) and http://localhost:3000/portal (staff).
With `db:seed:demo`, local-only demo logins are created (password `Moonstar@Demo2026`):
`employee@…`, `approver@…`, `pricing@…`, `viewer@moonstar.local`. To also create a Super Admin run
`SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='…' npm run db:migrate`.
**Demo data uses placeholder prices. Never seed it in production.**

Without `DATABASE_URL` the API uses an embedded Postgres that refuses to start in production.

## Scripts (root)

| Command | What it does |
|---|---|
| `npm run dev` | API + web in watch mode |
| `npm run build` / `npm start` | production build / run both |
| `npm test` | 54 backend tests: money, matrix, load engine, pricing, RBAC, immutability, HTTP/CSRF/rate-limit, PDF |
| `npm run typecheck` / `npm run lint` | TypeScript (both apps) / ESLint |
| `npm run db:migrate` | apply SQL migrations + ensure roles/permissions/settings (+ first admin from env) |
| `npm run lighthouse` | Lighthouse audit of key pages (needs Chrome) |
| `node scripts/e2e.mjs` | headless browser smoke test of the real UI flow |

## What is implemented

**Public website:** home (hero with GSAP + lazy three.js grid), about, solutions index + 8 detail pages,
product catalogue + product pages (only products explicitly published; **no prices/costs ever**),
projects (filterable), certifications, resources/FAQ (with FAQ schema), contact + consultation form
(stored in DB, honeypot + rate limit), sitemap, robots, security headers, reduced-motion support.

**Staff portal** (`/portal`): dashboard (live DB figures), New Quotation wizard, All/Revised
quotations with search + filters + pagination, quotation detail (versions, compare, approvals, PDF,
work order, history), Areas → Housing → Projects, Products & Price Book (price history, scheduled
prices), Reports (9 reports, date filters, CSV), Employees (users, roles, per-user permission
overrides), Settings (company, quotation template, tax, approval workflow, engineering rules, password),
Audit log, Website enquiries.

**Engineering:** the load engine builds a load matrix, computes demand with matrix products
(`1ᵀ·D`, diversity operator), power factor, PFI sizing, expansion margin, target loading and picks
standard ratings (or parallel units). 150 kW is *not* mapped to a fixed kVA: it depends on PF, demand
factor, diversity and expansion. Results are labelled **preliminary**; an authorised engineer can
override with a recorded reason. All assumptions are editable in Settings.

**Money:** BigInt paisa / milli-quantities / basis points. No floating point in any financial path.
Totals are always computed (and re-verified) on the server.

**Immutability:** database triggers make a quotation version and its items read-only once locked
(approved/sent/…); revisions create V2, V3… and the audit log is append-only.

## Security summary

bcrypt password hashing · server-side sessions (token stored as SHA-256) · login rate limiting (per email
and IP) · CSRF origin check · permission check on **every** API route and again in services ·
cost/margin fields stripped server-side for users without permission · zod validation ·
RLS enabled on every table (blocks Supabase's public REST API) · security headers · audit trail.

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for design decisions and trade-offs,
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) to go live, [docs/BACKUP-RECOVERY.md](docs/BACKUP-RECOVERY.md), and
[docs/CONTENT-TODO.md](docs/CONTENT-TODO.md) for items that need real company input.
