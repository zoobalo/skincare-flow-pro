import { createMiddleware } from "hono/factory";
import { verifyToken } from "./jwt.ts";
import { db } from "../../db/client.ts";
import { users } from "../../db/schema/users.ts";
import { eq } from "drizzle-orm";

export const requireAuth = createMiddleware(async (c, next) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const payload = await verifyToken(auth.slice(7));
  if (!payload) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
  // If token pre-dates multi-team, look up teamId from DB (fallback for old tokens)
  if (!payload.teamId) {
    const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
    if (!user) return c.json({ error: "User not found" }, 401);
    payload.teamId = user.teamId;
    payload.department = user.department;
  }
  c.set("user" as never, payload);
  await next();
});

export const requireAdmin = createMiddleware(async (c, next) => {
  const user = c.get("user" as never) as { role: string } | undefined;
  if (!user || user.role !== "Admin") {
    return c.json({ error: "Admin access required" }, 403);
  }
  await next();
});
