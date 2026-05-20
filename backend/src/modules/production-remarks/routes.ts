import { Hono } from "hono";
import { getAllRemarks, createRemark, updateRemark, deleteRemark } from "./queries.ts";

export const productionRemarkRoutes = new Hono()
  .get("/", async (c) => c.json(await getAllRemarks()))
  .post("/", async (c) => {
    try {
      const { skuId, materialType, remark, status } = await c.req.json();
      const [created] = await createRemark({
        id: crypto.randomUUID(),
        skuId: skuId ?? null,
        materialType: materialType ?? "None",
        remark: remark ?? "",
        status: status ?? "Active",
      });
      return c.json(created, 201);
    } catch (err: any) {
      return c.json({ error: err?.message ?? "Failed to create remark" }, 500);
    }
  })
  .patch("/:id", async (c) => {
    try {
      const body = await c.req.json();
      const patch: Record<string, unknown> = {};
      if (body.skuId        !== undefined) patch.skuId        = body.skuId ?? null;
      if (body.materialType !== undefined) patch.materialType = body.materialType;
      if (body.remark       !== undefined) patch.remark       = body.remark;
      if (body.status       !== undefined) patch.status       = body.status;
      const [updated] = await updateRemark(c.req.param("id"), patch);
      if (!updated) return c.json({ error: "Remark not found" }, 404);
      return c.json(updated);
    } catch (err: any) {
      return c.json({ error: err?.message ?? "Failed to update remark" }, 500);
    }
  })
  .delete("/:id", async (c) => {
    const [deleted] = await deleteRemark(c.req.param("id"));
    if (!deleted) return c.json({ error: "Remark not found" }, 404);
    return c.json({ ok: true });
  });
