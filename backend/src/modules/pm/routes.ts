import { Hono } from "hono";
import { getAllPms, getPmById, createPm, updatePm, deletePm } from "./queries.ts";
import { db } from "../../db/client.ts";
import { pmVendors, pmDispatches, pmComments, pmLinks } from "../../db/schema/packaging-materials.ts";
import { eq, asc, desc } from "drizzle-orm";
import { resolveTeamId } from "../../lib/resolve-team.ts";
import type { JWTPayload } from "../auth/jwt.ts";

export const pmRoutes = new Hono()
  // ── PM CRUD ──────────────────────────────────────────────────────────────────
  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "pm");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const search   = c.req.query("search")   ?? undefined;
    const category = c.req.query("category") ?? undefined;
    return c.json(await getAllPms(teamId, search, category));
  })
  .get("/:id", async (c) => {
    const data = await getPmById(c.req.param("id"));
    if (!data) return c.json({ error: "PM not found" }, 404);
    return c.json(data);
  })
  .post("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "pm");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const body = await c.req.json();
    try {
      const [created] = await createPm({ ...body, id: crypto.randomUUID(), teamId });
      return c.json(created, 201);
    } catch (err: any) {
      if (err?.code === "23505") return c.json({ error: `PM code "${body.code}" already exists.` }, 409);
      return c.json({ error: err?.message ?? "Failed to create PM" }, 500);
    }
  })
  .patch("/:id", async (c) => {
    try {
      const body = await c.req.json();
      const { code, name, category, description, specifications, image, currentStock, mfrStock, minThreshold, moq, leadTimeDays, costPerUnit, docsLink } = body;
      const [updated] = await updatePm(c.req.param("id"), { code, name, category, description, specifications, image, currentStock, mfrStock, minThreshold, moq, leadTimeDays, costPerUnit, docsLink });
      if (!updated) return c.json({ error: "PM not found" }, 404);
      return c.json(updated);
    } catch (err: any) {
      return c.json({ error: err?.message ?? "Failed to update PM" }, 500);
    }
  })
  .delete("/:id", async (c) => {
    const [deleted] = await deletePm(c.req.param("id"));
    if (!deleted) return c.json({ error: "PM not found" }, 404);
    return c.json({ ok: true });
  })

  // ── Vendors ──────────────────────────────────────────────────────────────────
  .post("/:id/vendors", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const body = await c.req.json();
    const [created] = await db.insert(pmVendors).values({
      ...body,
      id: crypto.randomUUID(),
      pmId: c.req.param("id"),
      teamId: user.teamId,
    }).returning();
    return c.json(created, 201);
  })
  .patch("/vendors/:vid", async (c) => {
    const body = await c.req.json();
    const { vendorId, vendorStatus, moq, leadTimeDays, costPerUnit, notes } = body;
    const [updated] = await db.update(pmVendors)
      .set({ vendorId, vendorStatus, moq, leadTimeDays, costPerUnit, notes })
      .where(eq(pmVendors.id, c.req.param("vid")))
      .returning();
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })
  .delete("/vendors/:vid", async (c) => {
    const [deleted] = await db.delete(pmVendors).where(eq(pmVendors.id, c.req.param("vid"))).returning();
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  })

  // ── Dispatches ───────────────────────────────────────────────────────────────
  .post("/:id/dispatches", async (c) => {
    const body = await c.req.json();
    const [created] = await db.insert(pmDispatches).values({
      ...body,
      id: crypto.randomUUID(),
      pmId: c.req.param("id"),
    }).returning();
    return c.json(created, 201);
  })
  .patch("/dispatches/:did", async (c) => {
    const body = await c.req.json();
    const { quantity, dispatchDate, from, to, transporterName, vehicleNumber, lrNumber, freight, status, notes } = body;
    const [updated] = await db.update(pmDispatches)
      .set({ quantity, dispatchDate, from, to, transporterName, vehicleNumber, lrNumber, freight, status, notes })
      .where(eq(pmDispatches.id, c.req.param("did")))
      .returning();
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })
  .delete("/dispatches/:did", async (c) => {
    const [deleted] = await db.delete(pmDispatches).where(eq(pmDispatches.id, c.req.param("did"))).returning();
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  })

  // ── Comments ─────────────────────────────────────────────────────────────────
  .get("/:id/comments", async (c) => {
    const rows = await db.select().from(pmComments)
      .where(eq(pmComments.pmId, c.req.param("id")))
      .orderBy(asc(pmComments.createdAt));
    return c.json(rows);
  })
  .post("/:id/comments", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const { text } = await c.req.json();
    if (!text?.trim()) return c.json({ error: "Comment text is required" }, 400);
    const [created] = await db.insert(pmComments).values({
      id: crypto.randomUUID(),
      pmId: c.req.param("id"),
      authorId: user.sub,
      authorName: user.name,
      text: text.trim(),
    }).returning();
    return c.json(created, 201);
  })
  .delete("/:id/comments/:cid", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const [comment] = await db.select().from(pmComments)
      .where(eq(pmComments.id, c.req.param("cid"))).limit(1);
    if (!comment) return c.json({ error: "Not found" }, 404);
    if (comment.authorId !== user.sub) return c.json({ error: "Forbidden" }, 403);
    await db.delete(pmComments).where(eq(pmComments.id, c.req.param("cid")));
    return c.json({ ok: true });
  })

  // ── Links ────────────────────────────────────────────────────────────────────
  .post("/:id/links", async (c) => {
    const body = await c.req.json();
    const [created] = await db.insert(pmLinks).values({
      ...body,
      id: crypto.randomUUID(),
      pmId: c.req.param("id"),
    }).returning();
    return c.json(created, 201);
  })
  .patch("/links/:lid", async (c) => {
    const body = await c.req.json();
    const { title, link, comment } = body;
    const [updated] = await db.update(pmLinks)
      .set({ title, link, comment })
      .where(eq(pmLinks.id, c.req.param("lid")))
      .returning();
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })
  .delete("/links/:lid", async (c) => {
    const [deleted] = await db.delete(pmLinks).where(eq(pmLinks.id, c.req.param("lid"))).returning();
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
