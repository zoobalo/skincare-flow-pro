import { Hono } from "hono";
import { db } from "../../db/client.ts";
import { warehouseQc } from "../../db/schema/warehouse-qc.ts";
import { eq, desc } from "drizzle-orm";
import type { JWTPayload } from "../auth/jwt.ts";

export const warehouseQcRoutes = new Hono()
  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const rows = await db.select().from(warehouseQc)
      .where(eq(warehouseQc.teamId, user.teamId))
      .orderBy(desc(warehouseQc.qcDate), desc(warehouseQc.createdAt));
    return c.json(rows);
  })
  .post("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const { qcDate, qcDoneBy, qcTypes, skuIds, reportText, reportImageUrl, reportLink, comment } = await c.req.json();
    if (!qcDate || !qcDoneBy?.trim()) return c.json({ error: "QC date and QC done by are required" }, 400);
    const [created] = await db.insert(warehouseQc).values({
      id:             crypto.randomUUID(),
      teamId:         user.teamId,
      qcDate,
      qcDoneBy:       qcDoneBy.trim(),
      qcTypes:        qcTypes ?? [],
      skuIds:         skuIds ?? [],
      reportText:     reportText?.trim() ?? "",
      reportImageUrl: reportImageUrl ?? null,
      reportLink:     reportLink?.trim() || null,
      comment:        comment?.trim() ?? "",
    }).returning();
    return c.json(created, 201);
  })
  .patch("/:id", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const { qcDate, qcDoneBy, qcTypes, skuIds, reportText, reportImageUrl, reportLink, comment } = await c.req.json();
    const [updated] = await db.update(warehouseQc)
      .set({
        ...(qcDate         !== undefined && { qcDate }),
        ...(qcDoneBy       !== undefined && { qcDoneBy: qcDoneBy.trim() }),
        ...(qcTypes        !== undefined && { qcTypes }),
        ...(skuIds         !== undefined && { skuIds }),
        ...(reportText     !== undefined && { reportText: reportText.trim() }),
        ...(reportImageUrl !== undefined && { reportImageUrl }),
        ...(reportLink     !== undefined && { reportLink: reportLink?.trim() || null }),
        ...(comment        !== undefined && { comment: comment.trim() }),
        updatedAt: new Date(),
      })
      .where(eq(warehouseQc.id, c.req.param("id")))
      .returning();
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })
  .delete("/:id", async (c) => {
    const [deleted] = await db.delete(warehouseQc)
      .where(eq(warehouseQc.id, c.req.param("id")))
      .returning();
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
