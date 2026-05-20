import { Hono } from "hono";
import { getAllSkus, getSkuById, createSku, updateSku, deleteSku } from "./queries.ts";

export const skuRoutes = new Hono()
  .get("/", async (c) => {
    const search   = c.req.query("search")   ?? undefined;
    const category = c.req.query("category") ?? undefined;
    const data = await getAllSkus(search, category);
    return c.json(data);
  })
  .get("/:id", async (c) => {
    const data = await getSkuById(c.req.param("id"));
    if (!data) return c.json({ error: "SKU not found" }, 404);
    return c.json(data);
  })
  .post("/", async (c) => {
    const body = await c.req.json();
    const [created] = await createSku({
      ...body,
      id: crypto.randomUUID(),
    });
    return c.json(created, 201);
  })
  .patch("/:id", async (c) => {
    const body = await c.req.json();
    const [updated] = await updateSku(c.req.param("id"), body);
    if (!updated) return c.json({ error: "SKU not found" }, 404);
    return c.json(updated);
  })
  .delete("/:id", async (c) => {
    const [deleted] = await deleteSku(c.req.param("id"));
    if (!deleted) return c.json({ error: "SKU not found" }, 404);
    return c.json({ ok: true });
  });
