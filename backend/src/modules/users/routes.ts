import { Hono } from "hono";
import { getAllUsers, getPendingUsers, getAllTeams } from "./queries.ts";
import { requireAdmin } from "../auth/middleware.ts";
import { db } from "../../db/client.ts";
import { users } from "../../db/schema/users.ts";
import { eq } from "drizzle-orm";

export const userRoutes = new Hono()
  // List all users — Admin only
  .get("/", requireAdmin, async (c) => {
    const data = await getAllUsers();
    return c.json(data);
  })
  // List pending users — Admin only
  .get("/pending", requireAdmin, async (c) => {
    const data = await getPendingUsers();
    return c.json(data);
  })
  // List all teams — Admin only
  .get("/teams", requireAdmin, async (c) => {
    const data = await getAllTeams();
    return c.json(data);
  })
  // Approve a pending user — Admin only
  .post("/:id/approve", requireAdmin, async (c) => {
    const { id } = c.req.param();
    const [updated] = await db
      .update(users)
      .set({ status: "Active" })
      .where(eq(users.id, id))
      .returning({ id: users.id, name: users.name, email: users.email, status: users.status, department: users.department });
    if (!updated) return c.json({ error: "User not found" }, 404);
    return c.json(updated);
  })
  // Reject a pending user — Admin only
  .post("/:id/reject", requireAdmin, async (c) => {
    const { id } = c.req.param();
    const [updated] = await db
      .update(users)
      .set({ status: "Rejected" })
      .where(eq(users.id, id))
      .returning({ id: users.id, name: users.name, email: users.email, status: users.status, department: users.department });
    if (!updated) return c.json({ error: "User not found" }, 404);
    return c.json(updated);
  })
  // Update user role/status — Admin only
  .patch("/:id", requireAdmin, async (c) => {
    const { id } = c.req.param();
    const body = await c.req.json();
    const [updated] = await db
      .update(users)
      .set({ ...(body.role && { role: body.role }), ...(body.status && { status: body.status }) })
      .where(eq(users.id, id))
      .returning();
    return c.json(updated);
  })
  // Delete user — Admin only
  .delete("/:id", requireAdmin, async (c) => {
    const { id } = c.req.param();
    await db.delete(users).where(eq(users.id, id));
    return c.json({ ok: true });
  });
