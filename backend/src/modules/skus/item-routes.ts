import { Hono } from "hono";
import { db } from "../../db/client.ts";
import { packagingItems, skuRawMaterials, skuTests, skuDispatches } from "../../db/schema/skus.ts";
import { eq } from "drizzle-orm";

export const skuItemRoutes = new Hono()
  // ── Packaging ────────────────────────────────────────────────────────────────
  .post("/:skuId/packaging", async (c) => {
    const body = await c.req.json();
    const [created] = await db.insert(packagingItems).values({
      ...body,
      id: crypto.randomUUID(),
      skuId: c.req.param("skuId"),
    }).returning();
    return c.json(created, 201);
  })
  .patch("/packaging/:id", async (c) => {
    const body = await c.req.json();
    const [updated] = await db.update(packagingItems).set(body).where(eq(packagingItems.id, c.req.param("id"))).returning();
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })
  .delete("/packaging/:id", async (c) => {
    const [deleted] = await db.delete(packagingItems).where(eq(packagingItems.id, c.req.param("id"))).returning();
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  })

  // ── Raw Materials ─────────────────────────────────────────────────────────────
  .post("/:skuId/raw-materials", async (c) => {
    const body = await c.req.json();
    const [created] = await db.insert(skuRawMaterials).values({
      ...body,
      id: crypto.randomUUID(),
      skuId: c.req.param("skuId"),
    }).returning();
    return c.json(created, 201);
  })
  .patch("/raw-materials/:id", async (c) => {
    const body = await c.req.json();
    const [updated] = await db.update(skuRawMaterials).set(body).where(eq(skuRawMaterials.id, c.req.param("id"))).returning();
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })
  .delete("/raw-materials/:id", async (c) => {
    const [deleted] = await db.delete(skuRawMaterials).where(eq(skuRawMaterials.id, c.req.param("id"))).returning();
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  })

  // ── Tests ─────────────────────────────────────────────────────────────────────
  .post("/:skuId/tests", async (c) => {
    const body = await c.req.json();
    const [created] = await db.insert(skuTests).values({
      id: crypto.randomUUID(),
      skuId: c.req.param("skuId"),
      testName: body.testName ?? "",
      result: body.result ?? "",
    }).returning();
    return c.json(created, 201);
  })
  .patch("/tests/:id", async (c) => {
    const body = await c.req.json();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (body.testName !== undefined) patch.testName = body.testName;
    if (body.result   !== undefined) patch.result   = body.result;
    const [updated] = await db.update(skuTests).set(patch).where(eq(skuTests.id, c.req.param("id"))).returning();
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })
  .delete("/tests/:id", async (c) => {
    const [deleted] = await db.delete(skuTests).where(eq(skuTests.id, c.req.param("id"))).returning();
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  })

  // ── Dispatches ────────────────────────────────────────────────────────────────
  .post("/:skuId/dispatches", async (c) => {
    const body = await c.req.json();
    const [created] = await db.insert(skuDispatches).values({
      id:              crypto.randomUUID(),
      skuId:           c.req.param("skuId"),
      goodsType:       body.goodsType ?? "Final Goods",
      goodsName:       body.goodsName ?? "",
      quantity:        body.quantity ?? 0,
      dispatchDate:    body.dispatchDate,
      from:            body.from ?? "",
      to:              body.to ?? "",
      transporterName: body.transporterName ?? "",
      vehicleNumber:   body.vehicleNumber ?? "",
      lrNumber:        body.lrNumber ?? "",
      freight:         body.freight ?? "0",
      status:          body.status ?? "Dispatched",
      notes:           body.notes ?? "",
    }).returning();
    return c.json(created, 201);
  })
  .patch("/dispatches/:id", async (c) => {
    const body = await c.req.json();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    const fields = ["goodsType","goodsName","quantity","dispatchDate","from","to","transporterName","vehicleNumber","lrNumber","freight","status","notes"];
    for (const f of fields) if (body[f] !== undefined) patch[f] = body[f];
    const [updated] = await db.update(skuDispatches).set(patch).where(eq(skuDispatches.id, c.req.param("id"))).returning();
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })
  .delete("/dispatches/:id", async (c) => {
    const [deleted] = await db.delete(skuDispatches).where(eq(skuDispatches.id, c.req.param("id"))).returning();
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
