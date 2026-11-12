import { readFileSync } from "node:fs";
import { Client } from "pg";
import { env } from "../config/env.js";

/**
 * Applies one hand-written .sql file, whole, in a transaction:
 *   npm run db:sql src/db/migrations/0001_complaints.sql
 *
 * Deliberately not drizzle-kit push — push diffs the entire schema against the
 * database and acts on everything it finds different, which is more than any
 * one change should be allowed to do to live data.
 */
async function main() {
  const file = process.argv[2];
  if (!file) { console.error("usage: npm run db:sql <file.sql>"); process.exit(1); }

  const sql = readFileSync(file, "utf8");
  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  console.log(`applying ${file} to ${new URL(env.DATABASE_URL).host}`);
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
    console.log("✅  applied");
  } catch (err) {
    await client.query("rollback");
    console.error("❌  rolled back:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
main();
