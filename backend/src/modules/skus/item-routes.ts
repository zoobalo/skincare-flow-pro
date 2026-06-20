import { Hono } from "hono";
import { db } from "../../db/client.ts";
import { packagingItems, skuRawMaterials, skuTests, skuDispatches } from "../../db/schema/skus.ts";
import { mftNotes } from "../../db/schema/mft-notes.ts";
import { skuComments } from "../../db/schema/sku-comments.ts";
import { skuLinks } from "../../db/schema/sku-links.ts";
import { eq, desc, asc } from "drizzle-orm";
import type { JWTPayload } from "../auth/jwt.ts";

export const skuItemRoutes = new Hono()
  // ── Packaging ────────────────────────────────────────────────────────────────
  .post("/:skuId/packaging", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const body = await c.req.json();
    const [created] = await db.insert(packagingItems).values({
      ...body,
      id: crypto.randomUUID(),
      skuId: c.req.param("skuId"),
      teamId: user.teamId,
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
  })

  // ── MFT Notes ─────────────────────────────────────────────────────────────────
  .get("/:skuId/mft", async (c) => {
    const rows = await db.select().from(mftNotes)
      .where(eq(mftNotes.skuId, c.req.param("skuId")))
      .orderBy(desc(mftNotes.date));
    return c.json(rows);
  })
  .post("/:skuId/mft", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const body = await c.req.json();
    const [created] = await db.insert(mftNotes).values({
      id:     crypto.randomUUID(),
      skuId:  c.req.param("skuId"),
      date:   body.date,
      notes:  body.notes ?? "",
      teamId: user.teamId,
    }).returning();
    return c.json(created, 201);
  })
  .patch("/mft/:id", async (c) => {
    const body = await c.req.json();
    const patch: Record<string, unknown> = {};
    if (body.date  !== undefined) patch.date  = body.date;
    if (body.notes !== undefined) patch.notes = body.notes;
    const [updated] = await db.update(mftNotes).set(patch).where(eq(mftNotes.id, c.req.param("id"))).returning();
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })
  .delete("/mft/:id", async (c) => {
    const [deleted] = await db.delete(mftNotes).where(eq(mftNotes.id, c.req.param("id"))).returning();
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  })

  // ── Comments ──────────────────────────────────────────────────────────────────
  .get("/:skuId/comments", async (c) => {
    const rows = await db.select().from(skuComments)
      .where(eq(skuComments.skuId, c.req.param("skuId")))
      .orderBy(desc(skuComments.createdAt));
    return c.json(rows);
  })
  .post("/:skuId/comments", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const { comment } = await c.req.json();
    const [created] = await db.insert(skuComments).values({
      id:         crypto.randomUUID(),
      skuId:      c.req.param("skuId"),
      comment:    comment ?? "",
      authorName: user.name ?? "",
    }).returning();
    return c.json(created, 201);
  })
  .patch("/comments/:id", async (c) => {
    const { comment } = await c.req.json();
    const [updated] = await db.update(skuComments)
      .set({ comment, updatedAt: new Date() })
      .where(eq(skuComments.id, c.req.param("id")))
      .returning();
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })
  .delete("/comments/:id", async (c) => {
    const [deleted] = await db.delete(skuComments).where(eq(skuComments.id, c.req.param("id"))).returning();
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  })

  // ── Links ─────────────────────────────────────────────────────────────────────
  .get("/:skuId/links", async (c) => {
    const rows = await db.select().from(skuLinks)
      .where(eq(skuLinks.skuId, c.req.param("skuId")))
      .orderBy(asc(skuLinks.createdAt));
    return c.json(rows);
  })
  .post("/:skuId/links", async (c) => {
    const { title, link, comment } = await c.req.json();
    if (!title?.trim() || !link?.trim()) return c.json({ error: "Title and link are required" }, 400);
    const [created] = await db.insert(skuLinks).values({
      id:      crypto.randomUUID(),
      skuId:   c.req.param("skuId"),
      title:   title.trim(),
      link:    link.trim(),
      comment: comment?.trim() ?? "",
    }).returning();
    return c.json(created, 201);
  })
  .patch("/links/:id", async (c) => {
    const { title, link, comment } = await c.req.json();
    const [updated] = await db.update(skuLinks)
      .set({
        ...(title   !== undefined && { title:   title.trim() }),
        ...(link    !== undefined && { link:    link.trim() }),
        ...(comment !== undefined && { comment: comment.trim() }),
      })
      .where(eq(skuLinks.id, c.req.param("id")))
      .returning();
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })
  .delete("/links/:id", async (c) => {
    const [deleted] = await db.delete(skuLinks).where(eq(skuLinks.id, c.req.param("id"))).returning();
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
