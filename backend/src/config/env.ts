import { config } from "dotenv";

// .env first, then .env.local on top of it. The local file is gitignored and
// holds the real credentials; .env is committed and carries only defaults, so
// the override direction matters — without it a stale committed value wins.
config();
config({ path: ".env.local", override: true });

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env variable: ${key}`);
  return v;
}

export const env = {
  // Render sets DATABASE_URL; locally it comes from .env.local, which names it
  // SUPABASE_DB_URL alongside the other Supabase settings.
  DATABASE_URL: process.env.DATABASE_URL || required("SUPABASE_DB_URL"),
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: parseInt(process.env.PORT ?? "3001", 10),
  JWT_SECRET: process.env.JWT_SECRET ?? "zoobalo-dev-secret-change-in-production",
};
