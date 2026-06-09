import { Hono } from "hono";
import { db } from "../../db/client.ts";
import { mftNotes } from "../../db/schema/mft-notes.ts";
import { eq, desc } from "drizzle-orm";

export const mftRoutes = new Hono()
  .get("/", async (c) => {
    const rows = await db.select().from(mftNotes).orderBy(desc(mftNotes.date), mftNotes.createdAt);
    return c.json(rows);
  })
  .post("/", async (c) => {
    const { skuId, date, notes } = await c.req.json();
    const [created] = await db.insert(mftNotes).values({
      id:    crypto.randomUUID(),
      skuId: skuId ?? null,
      date,
      notes,
    }).returning();
    return c.json(created, 201);
  })
  .patch("/:id", async (c) => {
    const body = await c.req.json();
    const patch: Record<string, unknown> = {};
    if (body.date  !== undefined) patch.date  = body.date;
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.skuId !== undefined) patch.skuId = body.skuId ?? null;
    const [updated] = await db.update(mftNotes).set(patch).where(eq(mftNotes.id, c.req.param("id"))).returning();
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })
  .delete("/:id", async (c) => {
    const [deleted] = await db.delete(mftNotes).where(eq(mftNotes.id, c.req.param("id"))).returning();
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
