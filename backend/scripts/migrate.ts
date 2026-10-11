import { getDb, runMigrations } from "../src/db/index";
import { seedBase, seedDemo, ensureUser } from "../src/db/seed";

// load backend/.env if present (never committed)
try { process.loadEnvFile(); } catch { /* no .env file */ }

async function main() {
  const d = await getDb();
  const applied = await runMigrations(d);
  console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Schema up to date");
  await seedBase(d);
  console.log("Base data (roles, permissions, categories, settings) ensured");
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    if (password.length < 10) throw new Error("SEED_ADMIN_PASSWORD must be at least 10 characters");
    const id = await ensureUser(d, { email, name: process.env.SEED_ADMIN_NAME ?? "Administrator", password, role: "super_admin", designation: "Administrator", signatory: false });
    console.log(id ? `Super admin created: ${email}` : `Super admin already exists: ${email}`);
  } else console.log("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — no admin created");
  if (process.env.SEED_DEMO === "1") {
    await seedDemo(d);
    console.log("Demo data seeded (placeholder prices — development only)");
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
