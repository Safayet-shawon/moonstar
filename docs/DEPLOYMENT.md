# Deployment

Two deployables (frontend, backend) + one Postgres database (Supabase).

## 1. Database: Supabase

1. Create a Supabase project. In **Project Settings → Database → Connection string** copy the
   **Transaction pooler** string (port 6543). Use it as `DATABASE_URL`.
2. Apply the schema and bootstrap the first admin from your machine (the migration runner is idempotent):

   ```bash
   DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres' \
   SEED_ADMIN_EMAIL='you@moonstarpower.com' SEED_ADMIN_PASSWORD='<strong password>' \
   npm run db:migrate
   ```
   Do **not** set `SEED_DEMO`. After the first sign-in, create real employees under *Employees* and
   enter real products under *Products & Price Book*.
3. All tables have Row Level Security enabled with no policies: the Supabase REST/anon API cannot read
   them. The API connects with the database role over `DATABASE_URL` only. Never expose that string to
   the frontend bundle. It is only read by the backend.

Connection pooling: the API uses a small `pg` pool (`DB_POOL_MAX`, default 5) in front of Supabase's pooler.
Alternative pooling for serverless: lower `DB_POOL_MAX` to 1–2 per instance.

## 2a. Vercel (recommended for the first launch)

Create **two Vercel projects** from the same Git repository:

| | Backend (API) | Frontend (web) |
|---|---|---|
| Root Directory | `backend` | `frontend` |
| Framework | Other: `backend/vercel.json` bundles the API with esbuild and serves it from `api/index.mjs` | Next.js |
| Install | handled by `vercel.json` (`npm install` at the workspace root; keep “include files outside root directory” ON) | default |
| Env vars | `DATABASE_URL`, `ALLOWED_ORIGINS=https://<web domain>`, `DB_POOL_MAX=2` | `BACKEND_URL=https://<api project domain>`, `NEXT_PUBLIC_SITE_URL=https://<web domain>` |

`BACKEND_URL` is compiled into the Next.js rewrites at build time: change it, then redeploy the frontend.
Add your custom domain (e.g. `www.moonstarpower.com`) to the **frontend** project only. The API domain can stay
private/unadvertised, and the browser never calls it directly.

The CDN, image optimisation, HTTP caching headers and gzip/brotli are provided by Vercel. `/img/*` and
`/_next/static/*` are immutable-cached; the public product list is cached for 5 min (`s-maxage`).

## 2b. Docker / own server (with load balancer)

```bash
cp .env.example .env            # fill DATABASE_URL, ALLOWED_ORIGINS, SEED_ADMIN_*
docker compose up --build -d    # nginx :80 -> 2x web + 2x api
docker compose run --rm api node dist/migrate.mjs
```

* `nginx/nginx.conf` load-balances (least_conn) across replicas, gzips, caches static assets and rate-limits
  `/api` and the login route. Terminate TLS in front of it (Caddy, Cloudflare, a cloud LB) and keep cookies
  `Secure`; if you test over plain HTTP set `INSECURE_COOKIES=1` (never in production).
* For a fully local DB: `docker compose --profile localdb up -d`, `DATABASE_URL=postgresql://moonstar:moonstar@db:5432/moonstar`,
  `DB_SSL=disable`.
* The Dockerfiles use multi-stage builds, non-root users and health checks. *They could not be built on the
  author's machine (no Docker installed). Run `docker compose build` once and report any issue.*

## 3. Post-deploy checklist

- [ ] Sign in as the Super Admin and change the password (Settings → My password).
- [ ] Settings → Company: verify address, phone, email, timezone (`Asia/Dhaka`).
- [ ] Settings → Quotation template: terms, payment terms, validity, **authorised signatory** (leave blank until the company authorises a name).
- [ ] Employees: create accounts; mark only authorised people as *Authorised signatory*.
- [ ] Products: enter real prices; tick *Show on public catalogue* only for products you want published.
- [ ] Review Engineering rules with a qualified engineer.
- [ ] `npm run lighthouse -- https://<your domain>`.
- [ ] Schedule backups (docs/BACKUP-RECOVERY.md).

## Environment variables

See [.env.example](../.env.example). Secrets live only in environment variables.

## Current live deployment (Vercel team "Shuttle")

| | URL |
|---|---|
| Website + portal | https://moonstar-web-five.vercel.app |
| API | https://moonstar-api.vercel.app (browser never calls it directly) |

**Until `DATABASE_URL` is set on the `moonstar-api` project the website pages render, but the portal, the enquiry form and the live catalogue return "service unavailable".** To activate:

```bash
# 1. add the Supabase pooler URL to the API project, 2. migrate/seed from your machine, 3. redeploy the API
vercel env add DATABASE_URL production        # run inside the linked backend project, paste the Supabase string
DATABASE_URL=... SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... npm run db:migrate
vercel deploy --prod
```
