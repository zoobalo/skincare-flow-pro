import { db } from "./client.js";
import {
  batchStageHistory, productionBatches,
  shipments, purchaseOrders,
  skuRawMaterials, skuDispatches, skuTests, packagingItems, skus,
  manufacturers, vendors, users,
  tasks, npd, productionRemarks, directory,
} from "./schema/index.js";

async function reset() {
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
