import { Hono } from "hono";
import { getAllDirectory, createEntry, updateEntry, deleteEntry } from "./queries.ts";
import { resolveTeamId } from "../../lib/resolve-team.ts";
import type { JWTPayload } from "../auth/jwt.ts";

export const directoryRoutes = new Hono()
  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "directory");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    return c.json(await getAllDirectory(teamId));
  })
  .post("/", async (c) => {
    try {
      const user = c.get("user" as never) as JWTPayload;
      const teamId = await resolveTeamId(c, user, "directory");
      if (!teamId) return c.json({ error: "Forbidden" }, 403);
      const body = await c.req.json();
      const [created] = await createEntry({
        id:            crypto.randomUUID(),
        name:          body.name ?? "",
        category:      body.category ?? "Other",
        address:       body.address ?? "",
        state:         body.state ?? "",
        country:       body.country ?? "",
        contact1Name:  body.contact1Name ?? "",
        contact1Phone: body.contact1Phone ?? "",
        contact2Name:  body.contact2Name ?? "",
        contact2Phone: body.contact2Phone ?? "",
        email1:        body.email1 ?? "",
        email2:        body.email2 ?? "",
        comment:       body.comment ?? "",
        teamId,
      });
      return c.json(created, 201);
    } catch (err: any) {
      return c.json({ error: err?.message ?? "Failed to create entry" }, 500);
    }
  })
  .patch("/:id", async (c) => {
    try {
      const body = await c.req.json();
      const patch: Record<string, unknown> = {};
      const fields = ["name","category","address","state","country","contact1Name","contact1Phone","contact2Name","contact2Phone","email1","email2","comment"];
      for (const f of fields) if (body[f] !== undefined) patch[f] = body[f];
      const [updated] = await updateEntry(c.req.param("id"), patch);
      if (!updated) return c.json({ error: "Not found" }, 404);
      return c.json(updated);
    } catch (err: any) {
      return c.json({ error: err?.message ?? "Failed to update entry" }, 500);
    }
  })
  .delete("/:id", async (c) => {
    const [deleted] = await deleteEntry(c.req.param("id"));
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
