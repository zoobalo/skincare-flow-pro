import { Hono } from "hono";
import { db } from "../../db/client.ts";
import { packagingItems, skuRawMaterials } from "../../db/schema/skus.ts";
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
  });
