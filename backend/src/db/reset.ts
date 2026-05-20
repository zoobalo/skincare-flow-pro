import { db } from "./client.js";
import {
  batchStageHistory, productionBatches,
  shipments, purchaseOrders,
  skuRawMaterials, packagingItems, skus,
  manufacturers, vendors, users,
} from "./schema/index.js";

async function reset() {
  console.log("⚠️  Resetting database — deleting all rows...");

  // delete in reverse FK dependency order
  await db.delete(batchStageHistory);
  await db.delete(productionBatches);
  await db.delete(shipments);
  await db.delete(purchaseOrders);
  await db.delete(skuRawMaterials);
  await db.delete(packagingItems);
  await db.delete(skus);
  await db.delete(manufacturers);
  await db.delete(vendors);
  await db.delete(users);

  console.log("✅ All tables cleared.");
  process.exit(0);
}

reset().catch((err) => { console.error(err); process.exit(1); });
