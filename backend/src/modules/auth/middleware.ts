import { createMiddleware } from "hono/factory";
import { verifyToken } from "./jwt.ts";

export const requireAuth = createMiddleware(async (c, next) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const payload = await verifyToken(auth.slice(7));
  if (!payload) {
    return c.json({ error: "Invalid or expired token" }, 401);
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
