import { Hono } from "hono";
import { getAllNpd, createNpd, updateNpd, deleteNpd } from "./queries.ts";
import type { JWTPayload } from "../auth/jwt.ts";

export const npdRoutes = new Hono()
  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    return c.json(await getAllNpd(user.teamId));
  })
  .post("/", async (c) => {
    try {
      const user = c.get("user" as never) as JWTPayload;
      const { name, launchMonth, rmStatus, pmStatus, images, comments } = await c.req.json();
      const [created] = await createNpd({ id: crypto.randomUUID(), name, launchMonth: launchMonth ?? null, rmStatus: rmStatus ?? "", pmStatus: pmStatus ?? "", images: images ?? [], comments: comments ?? "", teamId: user.teamId });
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
  })
  .post("/sync-sheet", async (c) => {
    const scriptUrl = process.env.APPS_SCRIPT_URL;
    if (!scriptUrl) return c.json({ error: "Google Sheets sync not configured — set APPS_SCRIPT_URL on the server" }, 503);
    try {
      const { rows } = await c.req.json();
      const res  = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
        redirect: "follow",
      });
      const data = await res.json() as { success: boolean; url?: string; error?: string };
      if (!data.success) return c.json({ error: data.error ?? "Apps Script returned failure" }, 502);
      return c.json({ url: data.url });
    } catch (err: any) {
      return c.json({ error: err?.message ?? "Failed to reach Apps Script" }, 500);
    }
  });
