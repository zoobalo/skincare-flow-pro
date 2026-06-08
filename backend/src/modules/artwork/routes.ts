import { Hono } from "hono";
import { getAllArtwork, createArtwork, updateArtwork, deleteArtwork } from "./queries.ts";

export const artworkRoutes = new Hono()
  .get("/", async (c) => {
    return c.json(await getAllArtwork());
  })
  .post("/", async (c) => {
    const { statusUpdatedAt, ...rest } = await c.req.json();
    const data = {
      ...rest,
      id: crypto.randomUUID(),
      ...(statusUpdatedAt ? { statusUpdatedAt: new Date(statusUpdatedAt) } : {}),
    };
    const [created] = await createArtwork(data);
    return c.json(created, 201);
  })
  .patch("/:id", async (c) => {
    const { statusUpdatedAt, ...rest } = await c.req.json();
    const data = {
      ...rest,
      updatedAt: new Date(),
      ...(statusUpdatedAt !== undefined
        ? { statusUpdatedAt: statusUpdatedAt ? new Date(statusUpdatedAt) : null }
        : {}),
    };
    const [updated] = await updateArtwork(c.req.param("id"), data);
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })
  .delete("/:id", async (c) => {
    const [deleted] = await deleteArtwork(c.req.param("id"));
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
