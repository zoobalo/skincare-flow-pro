import { Hono } from "hono";
import { getAllTasks, createTask, updateTask, deleteTask } from "./queries.ts";
import { resolveOwnerId } from "../../lib/resolve-owner.ts";
import type { JWTPayload } from "../auth/jwt.ts";

export const taskRoutes = new Hono()
  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const ownerUserId = await resolveOwnerId(c, user, "tasks");
    if (!ownerUserId) return c.json({ error: "Forbidden" }, 403);
    return c.json(await getAllTasks(ownerUserId));
  })
  .post("/", async (c) => {
    try {
      const user = c.get("user" as never) as JWTPayload;
      const ownerUserId = await resolveOwnerId(c, user, "tasks");
      if (!ownerUserId) return c.json({ error: "Forbidden" }, 403);
      const { title, comments, status, urgency, skuId, productType, deadlineDate } = await c.req.json();
      const [created] = await createTask({ id: crypto.randomUUID(), title, comments: comments ?? "", status: status ?? "None", urgency: urgency ?? "Medium", skuId: skuId ?? null, productType: productType ?? "None", deadlineDate: deadlineDate ?? null, teamId: user.teamId, ownerUserId });
      return c.json(created, 201);
    } catch (err: any) {
      return c.json({ error: err?.message ?? "Failed to create task" }, 500);
    }
  })
  .patch("/:id", async (c) => {
    try {
      const body = await c.req.json();
      const patch: Record<string, unknown> = {};
      if (body.title       !== undefined) patch.title       = body.title;
      if (body.comments    !== undefined) patch.comments    = body.comments;
      if (body.status      !== undefined) patch.status      = body.status;
      if (body.urgency     !== undefined) patch.urgency     = body.urgency;
      if (body.skuId       !== undefined) patch.skuId       = body.skuId ?? null;
      if (body.productType !== undefined) patch.productType = body.productType ?? "None";
      if (body.deadlineDate !== undefined) patch.deadlineDate = body.deadlineDate ?? null;
      const [updated] = await updateTask(c.req.param("id"), patch);
      if (!updated) return c.json({ error: "Task not found" }, 404);
      return c.json(updated);
    } catch (err: any) {
      return c.json({ error: err?.message ?? "Failed to update task" }, 500);
    }
  })
  .delete("/:id", async (c) => {
    const [deleted] = await deleteTask(c.req.param("id"));
    if (!deleted) return c.json({ error: "Task not found" }, 404);
    return c.json({ ok: true });
  });
