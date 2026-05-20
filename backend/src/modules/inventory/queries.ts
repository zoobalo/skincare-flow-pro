import { db } from "../../db/client.ts";
import { skus, packagingItems, skuRawMaterials } from "../../db/schema/skus.ts";
import { lt, sql } from "drizzle-orm";

export const getInventorySummary = async () => {
  const [allSkus, allPackaging, allRawMaterials] = await Promise.all([
    db.select().from(skus),
    db.select().from(packagingItems),
    db.select().from(skuRawMaterials),
  ]);

  const lowStockSkus = allSkus.filter((s) => s.currentInventory < s.minThreshold);
  const totalInventoryValue = allSkus.reduce((sum, s) => sum + s.currentInventory, 0);
  const totalPackagingStock = allPackaging.reduce((sum, p) => sum + p.currentStock, 0);
  const totalPackagingTransit = allPackaging.reduce((sum, p) => sum + p.transitStock, 0);

  return {
    totalSkus: allSkus.length,
    lowStockCount: lowStockSkus.length,
    lowStockSkus: lowStockSkus.map((s) => ({ id: s.id, code: s.code, name: s.name, currentInventory: s.currentInventory, minThreshold: s.minThreshold })),
    totalInventoryUnits: totalInventoryValue,
    totalPackagingStock,
    totalPackagingInTransit: totalPackagingTransit,
    totalRawMaterialLines: allRawMaterials.length,
  };
};

export const getPackagingInventory = () =>
  db.query.packagingItems.findMany({
    orderBy: (p, { asc }) => [asc(p.name)],
    with: { sku: { columns: { id: true, code: true, name: true } } },
  });

export const getRawMaterialsInventory = () =>
  db.query.skuRawMaterials.findMany({
    orderBy: (r, { asc }) => [asc(r.name)],
    with: { sku: { columns: { id: true, code: true, name: true } } },
  });
