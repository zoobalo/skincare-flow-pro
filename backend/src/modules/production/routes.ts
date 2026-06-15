import { Hono } from "hono";
import { getAllBatches, getBatchById, createBatch, updateBatch, updateBatchStage, deleteBatch } from "./queries.ts";
import type { JWTPayload } from "../auth/jwt.ts";

export const productionRoutes = new Hono()
  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const data = await getAllBatches(user.teamId);
    return c.json(data);
  })
  .get("/:id", async (c) => {
    const data = await getBatchById(c.req.param("id"));
    if (!data) return c.json({ error: "Batch not found" }, 404);
    return c.json(data);
  })
  .post("/", async (c) => {
    try {
      const user = c.get("user" as never) as JWTPayload;
      const body = await c.req.json();
      const { batchNumber, skuId, manufacturerId, vendorId, quantity, currentStage, startedAt, expectedCompletion, delayed, materialCategory, materialItemId, materialItemName, applicableStages, comment } = body;
      const [created] = await createBatch({ id: crypto.randomUUID(), batchNumber, skuId, manufacturerId, vendorId: vendorId ?? null, quantity, currentStage, startedAt, expectedCompletion, delayed: delayed ?? false, materialCategory: materialCategory ?? null, materialItemId: materialItemId ?? null, materialItemName: materialItemName ?? null, applicableStages: applicableStages ?? null, comment: comment ?? null, teamId: user.teamId });
      return c.json(created, 201);
    } catch (err: any) {
      console.error("POST /production error:", err);
      return c.json({ error: err?.message ?? "Failed to create batch" }, 500);
    }
  })
  .patch("/:id", async (c) => {
    try {
      const body = await c.req.json();
      const { batchNumber, skuId, manufacturerId, vendorId, quantity, currentStage, startedAt, expectedCompletion, delayed, materialCategory, materialItemId, materialItemName, applicableStages, comment } = body;
      const [updated] = await updateBatch(c.req.param("id"), { batchNumber, skuId, manufacturerId, vendorId: vendorId ?? null, quantity, currentStage, startedAt, expectedCompletion, delayed, materialCategory: materialCategory ?? null, materialItemId: materialItemId ?? null, materialItemName: materialItemName ?? null, applicableStages: applicableStages ?? null, comment: comment ?? null });
      if (!updated) return c.json({ error: "Batch not found" }, 404);
      return c.json(updated);
    } catch (err: any) {
      console.error("PATCH /production/:id error:", err);
      return c.json({ error: err?.message ?? "Failed to update batch" }, 500);
    }
  })
  .patch("/:id/stage", async (c) => {
    const { stage } = await c.req.json<{ stage: string }>();
    const [updated] = await updateBatchStage(c.req.param("id"), stage);
    if (!updated) return c.json({ error: "Batch not found" }, 404);
    return c.json(updated);
  })
  .delete("/:id", async (c) => {
    const [deleted] = await deleteBatch(c.req.param("id"));
    if (!deleted) return c.json({ error: "Batch not found" }, 404);
    return c.json({ ok: true });
  });
