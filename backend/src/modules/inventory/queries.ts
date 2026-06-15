import { db } from "../../db/client.ts";
import { skus, packagingItems, skuRawMaterials } from "../../db/schema/skus.ts";
import { eq, and, inArray } from "drizzle-orm";

export const getInventorySummary = async (teamId: string) => {
  const [allSkus, allPackaging] = await Promise.all([
    db.select().from(skus).where(eq(skus.teamId, teamId)),
    db.select().from(packagingItems).where(eq(packagingItems.teamId, teamId)),
  ]);

  const skuIds = allSkus.map((s) => s.id);
  const allRawMaterials = skuIds.length
    ? await db.select().from(skuRawMaterials).where(inArray(skuRawMaterials.skuId, skuIds))
    : [];

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

export const getPackagingInventory = (teamId: string) =>
  db.query.packagingItems.findMany({
    where: (p, { eq }) => eq(p.teamId, teamId),
    orderBy: (p, { asc }) => [asc(p.name)],
    with: { sku: { columns: { id: true, code: true, name: true } } },
  });

export const getRawMaterialsInventory = async (teamId: string) => {
  const teamSkus = await db.select({ id: skus.id }).from(skus).where(eq(skus.teamId, teamId));
  const skuIds = teamSkus.map((s) => s.id);
  if (!skuIds.length) return [];
  return db.query.skuRawMaterials.findMany({
    where: (r, { inArray }) => inArray(r.skuId, skuIds),
    orderBy: (r, { asc }) => [asc(r.name)],
    with: { sku: { columns: { id: true, code: true, name: true } } },
  });
};
