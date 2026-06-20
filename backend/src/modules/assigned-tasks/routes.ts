import { Hono } from "hono";
import { db } from "../../db/client.ts";
import { assignedTasks } from "../../db/schema/assigned-tasks.ts";
import { assignedTaskComments } from "../../db/schema/assigned-task-comments.ts";
import { users } from "../../db/schema/users.ts";
import { eq, desc, and, asc } from "drizzle-orm";
import type { JWTPayload } from "../auth/jwt.ts";

export const assignedTaskRoutes = new Hono()
  // Tasks assigned TO me
  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const rows = await db.select().from(assignedTasks)
      .where(eq(assignedTasks.assignedTo, user.sub))
      .orderBy(desc(assignedTasks.createdAt));
    return c.json(rows);
  })
  // Tasks assigned BY me
  .get("/by-me", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const rows = await db.select().from(assignedTasks)
      .where(eq(assignedTasks.assignedBy, user.sub))
      .orderBy(desc(assignedTasks.createdAt));
    return c.json(rows);
  })
  // All active users (for the assignee picker)
  .get("/users", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const rows = await db
      .select({ id: users.id, name: users.name, email: users.email, department: users.department })
      .from(users)
      .where(and(eq(users.status, "Active"), eq(users.teamId, user.teamId)));
    return c.json(rows);
  })
  // Assign a task
  .post("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const { title, comments, urgency, deadlineDate, assignedTo } = await c.req.json();
    if (!title?.trim()) return c.json({ error: "Title is required" }, 400);
    if (!assignedTo)    return c.json({ error: "Assignee is required" }, 400);
    // Resolve assignee name
    const [assignee] = await db.select({ name: users.name }).from(users).where(eq(users.id, assignedTo)).limit(1);
    if (!assignee) return c.json({ error: "Assignee not found" }, 404);
    const [created] = await db.insert(assignedTasks).values({
      id:             crypto.randomUUID(),
      teamId:         user.teamId,
      title:          title.trim(),
      comments:       comments?.trim() ?? "",
      urgency:        urgency ?? "Medium",
      deadlineDate:   deadlineDate ?? null,
      assignedTo,
      assignedToName: assignee.name,
      assignedBy:     user.sub,
      assignedByName: user.name,
      status:         "Pending",
    }).returning();
    return c.json(created, 201);
  })
  // Update status (assignee only)
  .patch("/:id/status", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const { status } = await c.req.json();
    const [row] = await db.select().from(assignedTasks).where(eq(assignedTasks.id, c.req.param("id"))).limit(1);
    if (!row) return c.json({ error: "Not found" }, 404);
    if (row.assignedTo !== user.sub) return c.json({ error: "Forbidden" }, 403);
    const [updated] = await db.update(assignedTasks)
      .set({ status, updatedAt: new Date() })
      .where(eq(assignedTasks.id, c.req.param("id")))
      .returning();
    return c.json(updated);
  })
  // Delete (assigner only)
  .delete("/:id", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const [row] = await db.select().from(assignedTasks).where(eq(assignedTasks.id, c.req.param("id"))).limit(1);
    if (!row) return c.json({ error: "Not found" }, 404);
    if (row.assignedBy !== user.sub) return c.json({ error: "Forbidden — only the assigner can delete" }, 403);
    await db.delete(assignedTaskComments).where(eq(assignedTaskComments.taskId, c.req.param("id")));
    await db.delete(assignedTasks).where(eq(assignedTasks.id, c.req.param("id")));
    return c.json({ ok: true });
  })

  // ── Comments ────────────────────────────────────────────────────────────────
  .get("/:id/comments", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const [task] = await db.select().from(assignedTasks).where(eq(assignedTasks.id, c.req.param("id"))).limit(1);
    if (!task) return c.json({ error: "Not found" }, 404);
    // Only assigner or assignee can view comments
    if (task.assignedBy !== user.sub && task.assignedTo !== user.sub) return c.json({ error: "Forbidden" }, 403);
    const rows = await db.select().from(assignedTaskComments)
      .where(eq(assignedTaskComments.taskId, c.req.param("id")))
      .orderBy(asc(assignedTaskComments.createdAt));
    return c.json(rows);
  })
  .post("/:id/comments", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const [task] = await db.select().from(assignedTasks).where(eq(assignedTasks.id, c.req.param("id"))).limit(1);
    if (!task) return c.json({ error: "Not found" }, 404);
    if (task.assignedBy !== user.sub && task.assignedTo !== user.sub) return c.json({ error: "Forbidden" }, 403);
    const { text } = await c.req.json();
    if (!text?.trim()) return c.json({ error: "Comment text is required" }, 400);
    const [created] = await db.insert(assignedTaskComments).values({
      id:         crypto.randomUUID(),
      taskId:     c.req.param("id"),
      authorId:   user.sub,
      authorName: user.name,
      text:       text.trim(),
    }).returning();
    return c.json(created, 201);
  })
  .delete("/:id/comments/:commentId", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const [comment] = await db.select().from(assignedTaskComments)
      .where(eq(assignedTaskComments.id, c.req.param("commentId"))).limit(1);
    if (!comment) return c.json({ error: "Not found" }, 404);
    if (comment.authorId !== user.sub) return c.json({ error: "Forbidden" }, 403);
    await db.delete(assignedTaskComments).where(eq(assignedTaskComments.id, c.req.param("commentId")));
    return c.json({ ok: true });
  });
