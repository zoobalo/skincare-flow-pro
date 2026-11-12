import { Hono } from "hono";
import { db } from "../../db/client.ts";
import { complaints, complaintComments } from "../../db/schema/complaints.ts";
import { skus } from "../../db/schema/skus.ts";
import { eq, inArray, asc, desc } from "drizzle-orm";
import type { JWTPayload } from "../auth/jwt.ts";

/**
 * Complaints are raised, discussed in a comment thread, and closed. A comment
 * carries who wrote it and when, because the thread is the record of how the
 * problem was worked — not just its outcome.
 */
export const complaintRoutes = new Hono()
  // The list carries its comments, so the page opens with every thread ready.
  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const rows = await db
      .select({
        complaint: complaints,
        skuCode:   skus.code,
        skuName:   skus.name,
      })
      .from(complaints)
      .leftJoin(skus, eq(skus.id, complaints.skuId))
      .where(eq(complaints.teamId, user.teamId))
      .orderBy(desc(complaints.createdAt));

    const comments = rows.length
      ? await db.select().from(complaintComments)
          .where(inArray(complaintComments.complaintId, rows.map((r) => r.complaint.id)))
          .orderBy(asc(complaintComments.createdAt))
      : [];

    const byComplaint = new Map<string, typeof comments>();
    for (const cm of comments) {
      const list = byComplaint.get(cm.complaintId) ?? [];
      list.push(cm);
      byComplaint.set(cm.complaintId, list);
    }
    return c.json(rows.map((r) => ({
      ...r.complaint,
      skuCode:  r.skuCode,
      skuName:  r.skuName,
      comments: byComplaint.get(r.complaint.id) ?? [],
    })));
  })

  .post("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const { title, details, against, kind, skuId } = await c.req.json();
    if (!title?.trim()) return c.json({ error: "A short title is required" }, 400);

    const type = kind === "SKU" ? "SKU" : "General";
    let sku: string | null = null;
    if (type === "SKU") {
      if (!skuId) return c.json({ error: "Choose the SKU this complaint is about" }, 400);
      const [found] = await db.select({ id: skus.id, teamId: skus.teamId })
        .from(skus).where(eq(skus.id, skuId)).limit(1);
      if (!found || found.teamId !== user.teamId) return c.json({ error: "SKU not found" }, 404);
      sku = found.id;
    }

    const [created] = await db.insert(complaints).values({
      id:           crypto.randomUUID(),
      teamId:       user.teamId,
      kind:         type,
      skuId:        sku,
      title:        title.trim(),
      details:      details?.trim() ?? "",
      against:      against?.trim() ?? "",
      status:       "Open",
      raisedById:   user.sub,
      raisedByName: user.name,
    }).returning();
    const named = sku
      ? (await db.select({ code: skus.code, name: skus.name }).from(skus).where(eq(skus.id, sku)).limit(1))[0]
      : undefined;
    return c.json({
      ...created,
      skuCode: named?.code ?? null,
      skuName: named?.name ?? null,
      comments: [],
    }, 201);
  })

  .patch("/:id", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const [row] = await db.select().from(complaints)
      .where(eq(complaints.id, c.req.param("id"))).limit(1);
    if (!row) return c.json({ error: "Not found" }, 404);
    if (row.teamId !== user.teamId) return c.json({ error: "Forbidden" }, 403);

    const { title, details, against, status } = await c.req.json();
    if (status !== undefined && status !== "Open" && status !== "Resolved")
      return c.json({ error: "Status must be Open or Resolved" }, 400);

    // Who closed it, and when — cleared again if it is reopened.
    const closing = status !== undefined && status !== row.status
      ? status === "Resolved"
        ? { resolvedById: user.sub, resolvedByName: user.name, resolvedAt: new Date() }
        : { resolvedById: null, resolvedByName: null, resolvedAt: null }
      : {};

    const [updated] = await db.update(complaints)
      .set({
        ...(title   !== undefined && { title: title.trim() }),
        ...(details !== undefined && { details: details.trim() }),
        ...(against !== undefined && { against: against.trim() }),
        ...(status  !== undefined && { status }),
        ...closing,
        updatedAt: new Date(),
      })
      .where(eq(complaints.id, c.req.param("id")))
      .returning();
    return c.json(updated);
  })

  .delete("/:id", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const [row] = await db.select().from(complaints)
      .where(eq(complaints.id, c.req.param("id"))).limit(1);
    if (!row) return c.json({ error: "Not found" }, 404);
    if (row.teamId !== user.teamId) return c.json({ error: "Forbidden" }, 403);
    if (row.raisedById !== user.sub)
      return c.json({ error: "Only the person who raised it can delete a complaint" }, 403);
    await db.delete(complaintComments).where(eq(complaintComments.complaintId, row.id));
    await db.delete(complaints).where(eq(complaints.id, row.id));
    return c.json({ ok: true });
  })

  // ── Comments ──────────────────────────────────────────────────────────────
  .post("/:id/comments", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const [row] = await db.select().from(complaints)
      .where(eq(complaints.id, c.req.param("id"))).limit(1);
    if (!row) return c.json({ error: "Not found" }, 404);
    if (row.teamId !== user.teamId) return c.json({ error: "Forbidden" }, 403);

    const { text } = await c.req.json();
    if (!text?.trim()) return c.json({ error: "Write something first" }, 400);

    const [created] = await db.insert(complaintComments).values({
      id:          crypto.randomUUID(),
      complaintId: row.id,
      authorId:    user.sub,
      authorName:  user.name,
      text:        text.trim(),
    }).returning();
    // An update on the complaint keeps it at the top of the list.
    await db.update(complaints).set({ updatedAt: new Date() }).where(eq(complaints.id, row.id));
    return c.json(created, 201);
  })

  .delete("/:id/comments/:commentId", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const [comment] = await db.select().from(complaintComments)
      .where(eq(complaintComments.id, c.req.param("commentId"))).limit(1);
    if (!comment) return c.json({ error: "Not found" }, 404);
    if (comment.authorId !== user.sub)
      return c.json({ error: "You can only delete your own comment" }, 403);
    await db.delete(complaintComments).where(eq(complaintComments.id, comment.id));
    return c.json({ ok: true });
  });
