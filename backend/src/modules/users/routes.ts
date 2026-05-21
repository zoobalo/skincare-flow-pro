import { Hono } from "hono";
import { getAllUsers } from "./queries.ts";
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
