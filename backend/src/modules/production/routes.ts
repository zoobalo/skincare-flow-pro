import { Hono } from "hono";
import { getAllBatches, getBatchById, createBatch, updateBatch, updateBatchStage, deleteBatch } from "./queries.ts";

export const productionRoutes = new Hono()
  .get("/", async (c) => {
    const data = await getAllBatches();
    return c.json(data);
  })
  .get("/:id", async (c) => {
    const data = await getBatchById(c.req.param("id"));
    if (!data) return c.json({ error: "Batch not found" }, 404);
    return c.json(data);
  })
  .post("/", async (c) => {
    const body = await c.req.json();
    const [created] = await createBatch({ ...body, id: crypto.randomUUID() });
    return c.json(created, 201);
  })
  .patch("/:id", async (c) => {
    const body = await c.req.json();
    const [updated] = await updateBatch(c.req.param("id"), body);
    if (!updated) return c.json({ error: "Batch not found" }, 404);
    return c.json(updated);
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
