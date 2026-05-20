import { Hono } from "hono";
import { getAllManufacturers, getManufacturerById, createManufacturer, updateManufacturer, deleteManufacturer } from "./queries.ts";

export const manufacturerRoutes = new Hono()
  .get("/", async (c) => {
    const data = await getAllManufacturers();
    return c.json(data);
  })
  .get("/:id", async (c) => {
    const data = await getManufacturerById(c.req.param("id"));
    if (!data) return c.json({ error: "Manufacturer not found" }, 404);
    return c.json(data);
  })
  .post("/", async (c) => {
    const body = await c.req.json();
    const [created] = await createManufacturer({ ...body, id: crypto.randomUUID() });
    return c.json(created, 201);
  })
  .patch("/:id", async (c) => {
    const body = await c.req.json();
    const [updated] = await updateManufacturer(c.req.param("id"), body);
    if (!updated) return c.json({ error: "Manufacturer not found" }, 404);
    return c.json(updated);
  })
  .delete("/:id", async (c) => {
    const [deleted] = await deleteManufacturer(c.req.param("id"));
    if (!deleted) return c.json({ error: "Manufacturer not found" }, 404);
    return c.json({ ok: true });
  });
