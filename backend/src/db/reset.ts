import { db } from "./client.js";
import { env } from "../config/env.js";
import {
  batchStageHistory, productionBatches,
  shipments, purchaseOrders,
  skuRawMaterials, skuDispatches, skuTests, packagingItems, skus,
  manufacturers, vendors, users,
  tasks, npd, productionRemarks, directory,
} from "./schema/index.js";

// Guard: DATABASE_URL can point at production (directly on EC2, or via an SSH
// tunnel from a laptop). Refuse to run unless the caller names the database
// they mean to wipe: CONFIRM_RESET=<dbname> npm run db:reset
function assertIntentional() {
  const url = new URL(env.DATABASE_URL);
  const dbName = url.pathname.slice(1);
  const confirmed = process.env.CONFIRM_RESET;

  if (confirmed !== dbName) {
    console.error(
      `\n⛔  Refusing to wipe "${dbName}" at ${url.host}.\n` +
        `    This deletes every row in 16 tables and cannot be undone.\n` +
        `    If you are certain, re-run with:\n\n` +
        `      CONFIRM_RESET=${dbName} npm run db:reset\n`
    );
    process.exit(1);
  }
}

async function reset() {
  assertIntentional();
  console.log("⚠️  Clearing all data (tables preserved)...");

  // Delete in reverse FK dependency order
  await db.delete(batchStageHistory);
  await db.delete(productionBatches);
  await db.delete(shipments);
  await db.delete(purchaseOrders);
  await db.delete(skuDispatches);
  await db.delete(skuTests);
  await db.delete(skuRawMaterials);
  await db.delete(packagingItems);
  await db.delete(skus);
  await db.delete(manufacturers);
  await db.delete(vendors);
  await db.delete(tasks);
  await db.delete(npd);
  await db.delete(productionRemarks);
  await db.delete(directory);
  await db.delete(users);

  console.log("✅  All data cleared. Tables and schema intact.");
  process.exit(0);
}

reset().catch((err) => { console.error(err); process.exit(1); });
