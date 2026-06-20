import { Hono } from "hono";
import { db } from "../../db/client.ts";
import { samples, sampleProducts } from "../../db/schema/samples.ts";
import { eq, desc, inArray } from "drizzle-orm";
import { resolveOwnerId } from "../../lib/resolve-owner.ts";
import type { JWTPayload } from "../auth/jwt.ts";

export const sampleRoutes = new Hono()

  // ── List all samples with products ──────────────────────────────────────────
  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const ownerUserId = await resolveOwnerId(c, user, "sample");
    if (!ownerUserId) return c.json({ error: "Forbidden" }, 403);
    const allSamples = await db.select().from(samples)
      .where(eq(samples.ownerUserId, ownerUserId))
      .orderBy(desc(samples.createdAt));
    if (!allSamples.length) return c.json([]);
    const sampleIds = allSamples.map((s) => s.id);
    const products = await db.select().from(sampleProducts)
      .where(inArray(sampleProducts.sampleId, sampleIds))
      .orderBy(sampleProducts.createdAt);
    const productsBySampleId = products.reduce<Record<string, typeof products>>((acc, p) => {
      (acc[p.sampleId] ??= []).push(p);
      return acc;
    }, {});
    return c.json(allSamples.map((s) => ({ ...s, products: productsBySampleId[s.id] ?? [] })));
  })

  // ── Create sample with products ─────────────────────────────────────────────
  .post("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const ownerUserId = await resolveOwnerId(c, user, "sample");
    if (!ownerUserId) return c.json({ error: "Forbidden" }, 403);
    const { personName, purpose, comment, products: productList } = await c.req.json();
    if (!personName?.trim()) return c.json({ error: "Person name is required" }, 400);
    if (!Array.isArray(productList) || !productList.length)
      return c.json({ error: "At least one product is required" }, 400);

    const [sample] = await db.insert(samples).values({
      id: crypto.randomUUID(), personName: personName.trim(),
      purpose: purpose?.trim() || null, comment: comment?.trim() || null,
      teamId: user.teamId, ownerUserId,
    }).returning();

    const insertedProducts = await db.insert(sampleProducts).values(
      productList.map((p: { productName: string; quantity: number }) => ({
        id:          crypto.randomUUID(),
        sampleId:    sample.id,
        productName: p.productName?.trim() ?? "",
        quantity:    Number(p.quantity) || 1,
        returned:    false,
        teamId:      user.teamId,
      }))
    ).returning();

    return c.json({ ...sample, products: insertedProducts }, 201);
  })

  // ── Delete sample (cascades products) ───────────────────────────────────────
  .delete("/:id", async (c) => {
    await db.delete(sampleProducts).where(eq(sampleProducts.sampleId, c.req.param("id")));
    const [deleted] = await db.delete(samples).where(eq(samples.id, c.req.param("id"))).returning();
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  })

  // ── Toggle product returned ──────────────────────────────────────────────────
  .patch("/:sampleId/products/:productId/return", async (c) => {
    const existing = await db.select().from(sampleProducts)
      .where(eq(sampleProducts.id, c.req.param("productId"))).limit(1);
    if (!existing.length) return c.json({ error: "Not found" }, 404);
    const nowReturned = !existing[0].returned;
    const [updated] = await db.update(sampleProducts)
      .set({ returned: nowReturned, returnedAt: nowReturned ? new Date() : null })
      .where(eq(sampleProducts.id, c.req.param("productId")))
      .returning();
    return c.json(updated);
  })

  // ── Delete a single product row ─────────────────────────────────────────────
  .delete("/:sampleId/products/:productId", async (c) => {
    const [deleted] = await db.delete(sampleProducts)
      .where(eq(sampleProducts.id, c.req.param("productId"))).returning();
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
