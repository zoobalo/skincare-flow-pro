import { Hono } from "hono";
import { getAllContacts, createContact, updateContact, deleteContact, createTask, updateTask, deleteTask } from "./queries.ts";
import { resolveTeamId } from "../../lib/resolve-team.ts";
import type { JWTPayload } from "../auth/jwt.ts";

export const followUpRoutes = new Hono()
  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "follow-ups");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    return c.json(await getAllContacts(teamId));
  })
  .post("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "follow-ups");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const body = await c.req.json();
    const [created] = await createContact({ ...body, id: crypto.randomUUID(), teamId });
    return c.json(created, 201);
  })
  .patch("/:id", async (c) => {
    const body = await c.req.json();
    const [updated] = await updateContact(c.req.param("id"), body);
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })
  .delete("/:id", async (c) => {
    const [deleted] = await deleteContact(c.req.param("id"));
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  })
  .post("/:id/tasks", async (c) => {
    const body = await c.req.json();
    const [created] = await createTask({ ...body, id: crypto.randomUUID(), contactId: c.req.param("id") });
    return c.json(created, 201);
  })
  .patch("/:id/tasks/:taskId", async (c) => {
    const { doneAt, ...rest } = await c.req.json();
    const data = {
      ...rest,
      ...(doneAt !== undefined ? { doneAt: doneAt ? new Date(doneAt) : null } : {}),
    };
    const [updated] = await updateTask(c.req.param("taskId"), data);
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })
  .delete("/:id/tasks/:taskId", async (c) => {
    const [deleted] = await deleteTask(c.req.param("taskId"));
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
