/**
 * Seed the database from the existing frontend mock data.
 * Run: bun run db:seed  (from the backend/ directory)
 */
import { db } from "./db/client.js";
import {
  vendors as vendorsTable,
  manufacturers as manufacturersTable,
  skus as skusTable,
  packagingItems,
  skuRawMaterials,
  purchaseOrders as purchaseOrdersTable,
  productionBatches as productionBatchesTable,
  batchStageHistory,
  shipments as shipmentsTable,
  users as usersTable,
} from "./db/schema/index.js";

// Import directly from the frontend mock data (no duplication)
import {
  vendors,
  manufacturers,
  skus,
  purchaseOrders,
  productionBatches,
  shipments,
} from "../../src/lib/mock/data.js";

const SEED_TEAM_ID = "seed-team";

async function seed() {
  console.log("🌱 Starting seed...\n");

  // ── 1. Vendors ──────────────────────────────────────────────────────────────
  console.log(`  Inserting ${vendors.length} vendors...`);
  await db.insert(vendorsTable).values(
    vendors.map((v) => ({
      id:            v.id,
      teamId:        SEED_TEAM_ID,
      name:          v.name,
      contactPerson: v.contactPerson,
      mobile:        v.mobile,
      email:         v.email,
      gst:           v.gst,
      address:       v.address,
      city:          v.city,
      materials:     v.materials,
      leadTimeDays:  v.leadTimeDays,
      paymentTerms:  v.paymentTerms,
      rating:        String(v.rating),
      reliability:   v.reliability,
      delayPercent:  v.delayPercent,
      totalOrders:   v.totalOrders,
      runningOrders: v.runningOrders,
      totalSpend:    String(v.totalSpend),
    }))
  ).onConflictDoNothing();

  // ── 2. Manufacturers ─────────────────────────────────────────────────────────
  console.log(`  Inserting ${manufacturers.length} manufacturers...`);
  await db.insert(manufacturersTable).values(
    manufacturers.map((m) => ({
      id:               m.id,
      teamId:           SEED_TEAM_ID,
      name:             m.name,
      location:         m.location,
      contactPerson:    m.contactPerson,
      mobile:           m.mobile,
      capacityPerMonth: m.capacityPerMonth,
      activeBatches:    m.activeBatches,
      qcPassRate:       String(m.qcPassRate),
    }))
  ).onConflictDoNothing();

  // ── 3. SKUs ──────────────────────────────────────────────────────────────────
  console.log(`  Inserting ${skus.length} SKUs...`);
  await db.insert(skusTable).values(
    skus.map((s) => ({
      id:                     s.id,
      teamId:                 SEED_TEAM_ID,
      code:                   s.code,
      name:                   s.name,
      category:               s.category,
      type:                   s.type,
      description:            s.description,
      image:                  s.image,
      manufacturerId:         s.manufacturerId,
      currentInventory:       s.currentInventory,
      minThreshold:           s.minThreshold,
      productionTimelineDays: s.productionTimelineDays,
    }))
  ).onConflictDoNothing();

  // ── 4. Packaging items ───────────────────────────────────────────────────────
  const allPackaging = skus.flatMap((s) =>
    s.packaging.map((p) => ({
      id:               p.id,
      teamId:           SEED_TEAM_ID,
      skuId:            s.id,
      name:             p.name,
      vendorId:         p.vendorId,
      moq:              p.moq,
      leadTimeDays:     p.leadTimeDays,
      currentStock:     p.currentStock,
      transitStock:     p.transitStock,
      costPerUnit:      String(p.costPerUnit),
      lastPurchaseDate: p.lastPurchaseDate ?? null,
    }))
  );
  console.log(`  Inserting ${allPackaging.length} packaging items...`);
  await db.insert(packagingItems).values(allPackaging).onConflictDoNothing();

  // ── 5. Raw materials (BOM) ───────────────────────────────────────────────────
  const allRawMaterials = skus.flatMap((s) =>
    s.rawMaterials.map((rm) => ({
      id:           rm.id,
      skuId:        s.id,
      name:         rm.name,
      vendorId:     rm.vendorId,
      qtyPerUnit:   String(rm.qtyPerUnit),
      unit:         rm.unit,
      currentStock: String(rm.currentStock),
      costPerUnit:  String(rm.costPerUnit),
    }))
  );
  console.log(`  Inserting ${allRawMaterials.length} raw material entries...`);
  await db.insert(skuRawMaterials).values(allRawMaterials).onConflictDoNothing();

  // ── 6. Purchase orders ───────────────────────────────────────────────────────
  console.log(`  Inserting ${purchaseOrders.length} purchase orders...`);
  await db.insert(purchaseOrdersTable).values(
    purchaseOrders.map((p) => ({
      id:               p.id,
      teamId:           SEED_TEAM_ID,
      poNumber:         p.poNumber,
      vendorId:         p.vendorId,
      skuId:            p.skuId,
      materialType:     p.materialType,
      quantity:         p.quantity,
      rate:             String(p.rate),
      total:            String(p.total),
      dispatchDate:     p.dispatchDate,
      expectedDelivery: p.expectedDelivery,
      status:           p.status,
      paymentDue:       p.paymentDue != null ? String(p.paymentDue) : null,
    }))
  ).onConflictDoNothing();

  // ── 7. Production batches ────────────────────────────────────────────────────
  console.log(`  Inserting ${productionBatches.length} production batches...`);
  await db.insert(productionBatchesTable).values(
    productionBatches.map((b) => ({
      id:                 b.id,
      teamId:             SEED_TEAM_ID,
      batchNumber:        b.batchNumber,
      skuId:              b.skuId,
      manufacturerId:     b.manufacturerId,
      quantity:           b.quantity,
      currentStage:       b.currentStage as string,
      startedAt:          b.startedAt,
      expectedCompletion: b.expectedCompletion,
      delayed:            b.delayed,
    })) as any
  ).onConflictDoNothing();

  // ── 8. Batch stage history ───────────────────────────────────────────────────
  const allStageHistory = productionBatches.flatMap((b) =>
    b.stageHistory.map((h) => ({
      batchId: b.id,
      stage:   h.stage,
      date:    h.date,
      note:    h.note ?? null,
    }))
  );
  console.log(`  Inserting ${allStageHistory.length} stage history entries...`);
  if (allStageHistory.length > 0) {
    await db.insert(batchStageHistory).values(allStageHistory as any).onConflictDoNothing();
  }

  // ── 9. Shipments ─────────────────────────────────────────────────────────────
  console.log(`  Inserting ${shipments.length} shipments...`);
  await db.insert(shipmentsTable).values(
    shipments.map((s) => ({
      id:               s.id,
      teamId:           SEED_TEAM_ID,
      lrNumber:         s.lrNumber,
      transporter:      s.transporter,
      driverName:       s.driverName,
      vehicleNumber:    s.vehicleNumber,
      origin:           s.origin,
      destination:      s.destination,
      pickupDate:       s.pickupDate,
      expectedDelivery: s.expectedDelivery,
      currentLocation:  s.currentLocation,
      freightCost:      String(s.freightCost),
      status:           s.status,
      linkedPoNumber:   s.linkedPO ?? null,
    }))
  ).onConflictDoNothing();

  // ── 10. Users ────────────────────────────────────────────────────────────────
  const seedUsers = [
    { id: "u1", teamId: SEED_TEAM_ID, name: "Priya Ojha",    email: "priya@skinops.demo",  role: "Ops Manager"            },
    { id: "u2", teamId: SEED_TEAM_ID, name: "Rohan Mehta",   email: "rohan@skinops.demo",  role: "Procurement Lead"        },
    { id: "u3", teamId: SEED_TEAM_ID, name: "Anita Verma",   email: "anita@skinops.demo",  role: "Warehouse Manager"       },
    { id: "u4", teamId: SEED_TEAM_ID, name: "Karan Shah",    email: "karan@skinops.demo",  role: "Quality Analyst",   status: "Inactive" },
    { id: "u5", teamId: SEED_TEAM_ID, name: "Neha Singh",    email: "neha@skinops.demo",   role: "Logistics Coordinator"   },
  ];
  console.log(`  Inserting ${seedUsers.length} users...`);
  await db.insert(usersTable).values(seedUsers as any).onConflictDoNothing();

  console.log("\n✅ Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
