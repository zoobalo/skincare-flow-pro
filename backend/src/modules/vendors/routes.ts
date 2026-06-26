import { Hono } from "hono";
import { getAllVendors, getVendorById, createVendor, updateVendor, deleteVendor } from "./queries.ts";
import { db } from "../../db/client.ts";
import { purchaseOrders } from "../../db/schema/purchase-orders.ts";
import { vendorComments } from "../../db/schema/vendor-comments.ts";
import { eq, count, asc } from "drizzle-orm";
import { resolveTeamId } from "../../lib/resolve-team.ts";
import type { JWTPayload } from "../auth/jwt.ts";

export const vendorRoutes = new Hono()
  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "vendors");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const data = await getAllVendors(teamId);
    return c.json(data);
  })
  .get("/:id", async (c) => {
    const data = await getVendorById(c.req.param("id"));
    if (!data) return c.json({ error: "Vendor not found" }, 404);
    return c.json(data);
  })
  .post("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "vendors");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const body = await c.req.json();
    const [created] = await createVendor({
      ...body,
      id: crypto.randomUUID(),
      teamId,
      materials: Array.isArray(body.materials) ? body.materials : body.materials?.split(",").map((s: string) => s.trim()).filter(Boolean) ?? [],
    });
    return c.json(created, 201);
  })
  .patch("/:id", async (c) => {
    const body = await c.req.json();
    const { name, contactPerson, mobile, email, gst, pan, address, city, materials, leadTimeDays, paymentTerms, rating, reliability, delayPercent, totalOrders, runningOrders, totalSpend, contacts, docsLink } = body;
    const patch: Record<string, unknown> = { name, contactPerson, mobile, email, gst, pan, address, city, leadTimeDays, paymentTerms, rating, reliability, delayPercent, totalOrders, runningOrders, totalSpend, contacts, docsLink };
    if (materials !== undefined) {
      patch.materials = Array.isArray(materials) ? materials : materials?.split(",").map((s: string) => s.trim()).filter(Boolean) ?? [];
    }
    const [updated] = await updateVendor(c.req.param("id"), patch);
    if (!updated) return c.json({ error: "Vendor not found" }, 404);
    return c.json(updated);
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const [{ value: poCount }] = await db.select({ value: count() }).from(purchaseOrders).where(eq(purchaseOrders.vendorId, id));
    if (poCount > 0) return c.json({ error: `Cannot delete: this vendor has ${poCount} purchase order(s). Delete or reassign them first.` }, 409);
    const [deleted] = await deleteVendor(id);
    if (!deleted) return c.json({ error: "Vendor not found" }, 404);
    return c.json({ ok: true });
  })

  // ── Comments ────────────────────────────────────────────────────────────────
  .get("/:id/comments", async (c) => {
    const rows = await db.select().from(vendorComments)
      .where(eq(vendorComments.vendorId, c.req.param("id")))
      .orderBy(asc(vendorComments.createdAt));
    return c.json(rows);
  })
  .post("/:id/comments", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const { text } = await c.req.json();
    if (!text?.trim()) return c.json({ error: "Comment text is required" }, 400);
    const [created] = await db.insert(vendorComments).values({
      id:         crypto.randomUUID(),
      vendorId:   c.req.param("id"),
      authorId:   user.sub,
      authorName: user.name,
      text:       text.trim(),
    }).returning();
    return c.json(created, 201);
  })
  .delete("/:id/comments/:commentId", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const [comment] = await db.select().from(vendorComments)
      .where(eq(vendorComments.id, c.req.param("commentId"))).limit(1);
    if (!comment) return c.json({ error: "Not found" }, 404);
    if (comment.authorId !== user.sub) return c.json({ error: "Forbidden" }, 403);
    await db.delete(vendorComments).where(eq(vendorComments.id, c.req.param("commentId")));
    return c.json({ ok: true });
  });
