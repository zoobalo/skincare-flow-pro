import { Hono } from "hono";
import { getAllContacts, createContact, updateContact, deleteContact, createTask, updateTask, deleteTask } from "./queries.ts";

export const followUpRoutes = new Hono()
  .get("/", async (c) => {
    return c.json(await getAllContacts());
  })
  .post("/", async (c) => {
    const body = await c.req.json();
    const [created] = await createContact({ ...body, id: crypto.randomUUID() });
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
    const body = await c.req.json();
    const [updated] = await updateTask(c.req.param("taskId"), body);
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })
  .delete("/:id/tasks/:taskId", async (c) => {
    const [deleted] = await deleteTask(c.req.param("taskId"));
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
