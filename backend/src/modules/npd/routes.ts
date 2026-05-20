import { Hono } from "hono";
import { getAllNpd, createNpd, updateNpd, deleteNpd } from "./queries.ts";

export const npdRoutes = new Hono()
  .get("/", async (c) => c.json(await getAllNpd()))
  .post("/", async (c) => {
    try {
      const { name, launchMonth, rmStatus, pmStatus, images, comments } = await c.req.json();
      const [created] = await createNpd({ id: crypto.randomUUID(), name, launchMonth: launchMonth ?? null, rmStatus: rmStatus ?? "", pmStatus: pmStatus ?? "", images: images ?? [], comments: comments ?? "" });
      return c.json(created, 201);
    } catch (err: any) {
      return c.json({ error: err?.message ?? "Failed to create NPD" }, 500);
    }
  })
  .patch("/:id", async (c) => {
    try {
      const body = await c.req.json();
      const patch: Record<string, unknown> = {};
      if (body.name        !== undefined) patch.name        = body.name;
      if (body.launchMonth !== undefined) patch.launchMonth = body.launchMonth ?? null;
      if (body.rmStatus    !== undefined) patch.rmStatus    = body.rmStatus;
      if (body.pmStatus    !== undefined) patch.pmStatus    = body.pmStatus;
      if (body.images      !== undefined) patch.images      = body.images;
      if (body.comments    !== undefined) patch.comments    = body.comments;
      const [updated] = await updateNpd(c.req.param("id"), patch);
      if (!updated) return c.json({ error: "NPD not found" }, 404);
      return c.json(updated);
    } catch (err: any) {
      return c.json({ error: err?.message ?? "Failed to update NPD" }, 500);
    }
  })
  .delete("/:id", async (c) => {
    const [deleted] = await deleteNpd(c.req.param("id"));
    if (!deleted) return c.json({ error: "NPD not found" }, 404);
    return c.json({ ok: true });
  });
