import { Hono } from "hono";
import { getAllImpLinks, createImpLink, updateImpLink, deleteImpLink } from "./queries.ts";

export const impLinkRoutes = new Hono()
  .get("/", async (c) => {
    return c.json(await getAllImpLinks());
  })
  .post("/", async (c) => {
    const body = await c.req.json();
    const [created] = await createImpLink({ ...body, id: crypto.randomUUID() });
    return c.json(created, 201);
  })
  .patch("/:id", async (c) => {
    const body = await c.req.json();
    const [updated] = await updateImpLink(c.req.param("id"), { ...body, updatedAt: new Date() });
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })
  .delete("/:id", async (c) => {
    const [deleted] = await deleteImpLink(c.req.param("id"));
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
