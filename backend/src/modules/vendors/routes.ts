import { Hono } from "hono";
import { getAllVendors, getVendorById, createVendor, updateVendor, deleteVendor } from "./queries.ts";

export const vendorRoutes = new Hono()
  .get("/", async (c) => {
    const data = await getAllVendors();
    return c.json(data);
  })
  .get("/:id", async (c) => {
    const data = await getVendorById(c.req.param("id"));
    if (!data) return c.json({ error: "Vendor not found" }, 404);
    return c.json(data);
  })
  .post("/", async (c) => {
    const body = await c.req.json();
    const [created] = await createVendor({
      ...body,
      id: crypto.randomUUID(),
      materials: Array.isArray(body.materials) ? body.materials : body.materials?.split(",").map((s: string) => s.trim()).filter(Boolean) ?? [],
    });
    return c.json(created, 201);
  })
  .patch("/:id", async (c) => {
    const body = await c.req.json();
    if (body.materials && !Array.isArray(body.materials)) {
      body.materials = body.materials.split(",").map((s: string) => s.trim()).filter(Boolean);
    }
    const [updated] = await updateVendor(c.req.param("id"), body);
    if (!updated) return c.json({ error: "Vendor not found" }, 404);
    return c.json(updated);
  })
  .delete("/:id", async (c) => {
    const [deleted] = await deleteVendor(c.req.param("id"));
    if (!deleted) return c.json({ error: "Vendor not found" }, 404);
    return c.json({ ok: true });
  });
