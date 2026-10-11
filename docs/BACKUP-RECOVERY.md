# Backup & recovery

## What must be protected
All business state is in PostgreSQL: users/roles, projects, products & **price history**, quotations and their
**immutable versions**, approvals, work orders, audit log and settings. The application containers are stateless.
PDFs are regenerated deterministically from the stored version snapshot (`documents` table keeps their SHA-256).

## Supabase (managed)
* Paid plans include **daily backups** (and optional Point-in-Time Recovery); enable PITR for a quotation system.
* Restore from the dashboard: *Database → Backups → Restore*. After a restore, redeploy nothing, as the API reconnects.

## Independent logical backup (recommended in addition)
Run nightly from any machine with `pg_dump` ≥ the server version. Use the **direct** (port 5432) or session-pooler connection, not the transaction pooler.

```bash
pg_dump "$DIRECT_DATABASE_URL" --format=custom --no-owner --file=moonstar-$(date +%F).dump
# keep 14 dailies + 6 monthlies, copy off-site and encrypt (e.g. age/gpg) before upload
```

Windows Task Scheduler / cron / a GitHub Actions scheduled workflow can all run this.

## Restore drill (test it quarterly)
```bash
createdb moonstar_restore
pg_restore --no-owner --dbname=moonstar_restore moonstar-2026-01-01.dump
# point a staging API at it:
DATABASE_URL=postgresql://…/moonstar_restore npm run start -w backend
```
Verify: sign in, open a recent quotation, download its PDF, check `SELECT count(*) FROM audit_logs`.

## Disaster scenarios
| Scenario | Action |
|---|---|
| Bad price import | Prices are versioned: `price_history`. Re-apply the previous price (new history row); old quotations are unaffected. |
| Deleted/corrupted rows | PITR to just before the incident into a *new* project, export the affected tables, `INSERT … SELECT` back. |
| Lost admin access | Run `SEED_ADMIN_EMAIL=… SEED_ADMIN_PASSWORD=… npm run db:migrate` with `DATABASE_URL` set. It creates a Super Admin if the e-mail is new. |
| Leaked `DATABASE_URL` | Rotate the DB password in Supabase, update env vars on both hosts, redeploy; `DELETE FROM sessions;` to sign everyone out. |
| Suspected account compromise | Disable the user (Employees), which revokes sessions immediately, then review the audit log. |

The audit log is append-only at the database level (triggers block UPDATE/DELETE), so it is also evidence after an incident.
