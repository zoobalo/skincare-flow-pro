import { Hono } from "hono";
import { getAllSkus, getSkuById, createSku, updateSku, deleteSku } from "./queries.ts";
import { db } from "../../db/client.ts";
import { skus, skuDispatches } from "../../db/schema/skus.ts";
import { skuComments } from "../../db/schema/sku-comments.ts";
import { purchaseOrders } from "../../db/schema/purchase-orders.ts";
import { productionBatches } from "../../db/schema/production.ts";
import { eq, count, asc, desc, inArray } from "drizzle-orm";
import { resolveTeamId } from "../../lib/resolve-team.ts";
import type { JWTPayload } from "../auth/jwt.ts";

export const skuRoutes = new Hono()
  // Must be before /:id to avoid being matched as skuId
  .get("/all-comments", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, ["skus", "sku-activity"]);
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const teamSkus = await db.select({ id: skus.id, code: skus.code, name: skus.name })
      .from(skus).where(eq(skus.teamId, teamId));
    if (!teamSkus.length) return c.json([]);
    const skuMap = Object.fromEntries(teamSkus.map((s) => [s.id, s]));
    const skuIds = teamSkus.map((s) => s.id);
    const comments = await db.select().from(skuComments)
      .where(inArray(skuComments.skuId, skuIds))
      .orderBy(asc(skuComments.createdAt));
    return c.json(comments.map((c) => ({
      ...c,
      skuCode: skuMap[c.skuId]?.code ?? "",
      skuName: skuMap[c.skuId]?.name ?? "",
    })));
  })
  .get("/all-dispatches", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, ["skus", "sku-activity"]);
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const teamSkus = await db.select({ id: skus.id, code: skus.code, name: skus.name })
      .from(skus).where(eq(skus.teamId, teamId));
    if (!teamSkus.length) return c.json([]);
    const skuMap = Object.fromEntries(teamSkus.map((s) => [s.id, s]));
    const skuIds = teamSkus.map((s) => s.id);
    const dispatches = await db.select().from(skuDispatches)
      .where(inArray(skuDispatches.skuId, skuIds))
      .orderBy(desc(skuDispatches.dispatchDate));
    return c.json(dispatches.map((d) => ({
      ...d,
      skuCode: skuMap[d.skuId]?.code ?? "",
      skuName: skuMap[d.skuId]?.name ?? "",
    })));
  })
  .get("/", async (c) => {
    const user     = c.get("user" as never) as JWTPayload;
    const teamId   = await resolveTeamId(c, user, "skus");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const search   = c.req.query("search")   ?? undefined;
    const category = c.req.query("category") ?? undefined;
    const data = await getAllSkus(teamId, search, category);
    return c.json(data);
  })
  .get("/:id", async (c) => {
    try {
      const data = await getSkuById(c.req.param("id"));
      if (!data) return c.json({ error: "SKU not found" }, 404);
      return c.json(data);
    } catch (err: any) {
      console.error("GET /skus/:id error:", err);
      return c.json({ error: err?.message ?? "Failed to fetch SKU" }, 500);
    }
  })
  .post("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "skus");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const body = await c.req.json();
    try {
      const [created] = await createSku({ ...body, id: crypto.randomUUID(), teamId });
      return c.json(created, 201);
    } catch (err: any) {
      if (err?.code === "23505") {
        return c.json({ error: `SKU code "${body.code}" already exists. Please use a different code.` }, 409);
      }
      throw err;
    }
  })
  .patch("/:id", async (c) => {
    const body = await c.req.json();
    const [updated] = await updateSku(c.req.param("id"), body);
    if (!updated) return c.json({ error: "SKU not found" }, 404);
    return c.json(updated);
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const [{ value: poCount }] = await db.select({ value: count() }).from(purchaseOrders).where(eq(purchaseOrders.skuId, id));
    if (poCount > 0) return c.json({ error: `Cannot delete: ${poCount} purchase order(s) are linked to this SKU. Delete them first.` }, 409);
    const [{ value: batchCount }] = await db.select({ value: count() }).from(productionBatches).where(eq(productionBatches.skuId, id));
    if (batchCount > 0) return c.json({ error: `Cannot delete: ${batchCount} production batch(es) are linked to this SKU. Delete them first.` }, 409);
    const [deleted] = await deleteSku(id);
    if (!deleted) return c.json({ error: "SKU not found" }, 404);
    return c.json({ ok: true });
  });
