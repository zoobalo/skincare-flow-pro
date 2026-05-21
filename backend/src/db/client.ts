import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env.js";
import * as schema from "./schema/index.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const poolConfig: any = {
  connectionString: env.DATABASE_URL,
  family: 4,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
};
const pool = new Pool(poolConfig);

export const db = drizzle({ client: pool, schema });
export type DB = typeof db;
