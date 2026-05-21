import { Hono } from "hono";
import { compare, hash } from "bcryptjs";
import { db } from "../../db/client.ts";
import { users } from "../../db/schema/users.ts";
import { eq } from "drizzle-orm";
import { signToken, verifyToken } from "./jwt.ts";
import { randomUUID } from "crypto";

export const authRoutes = new Hono()

  // ── POST /api/auth/signup ────────────────────────────────────────────────────
  .post("/signup", async (c) => {
    const { name, email, password, role } = await c.req.json();

    if (!name || !email || !password)
      return c.json({ error: "name, email and password are required" }, 400);

    if (password.length < 8)
      return c.json({ error: "Password must be at least 8 characters" }, 400);

    const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (existing.length > 0)
      return c.json({ error: "An account with this email already exists" }, 409);

    // First user ever becomes Admin automatically
    const count = await db.select().from(users);
    const assignedRole = count.length === 0 ? "Admin" : (role === "Admin" ? "Manager" : (role ?? "Manager"));

    const passwordHash = await hash(password, 10);
    const [user] = await db.insert(users).values({
      id:   randomUUID(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      role: assignedRole,
      passwordHash,
    }).returning();

    const token = await signToken({ sub: user.id, email: user.email, role: user.role, name: user.name });
    return c.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } }, 201);
  })

  // ── POST /api/auth/login ─────────────────────────────────────────────────────
  .post("/login", async (c) => {
    const { email, password } = await c.req.json();

    if (!email || !password)
      return c.json({ error: "Email and password are required" }, 400);

    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (!user)
      return c.json({ error: "Invalid email or password" }, 401);

    if (user.status === "Inactive")
      return c.json({ error: "Your account has been deactivated. Contact your admin." }, 403);

    const valid = await compare(password, user.passwordHash);
    if (!valid)
      return c.json({ error: "Invalid email or password" }, 401);

    const token = await signToken({ sub: user.id, email: user.email, role: user.role, name: user.name });
    return c.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  })

  // ── GET /api/auth/me ─────────────────────────────────────────────────────────
  .get("/me", async (c) => {
    const auth = c.req.header("Authorization");
    if (!auth?.startsWith("Bearer "))
      return c.json({ error: "Unauthorized" }, 401);

    const payload = await verifyToken(auth.slice(7));
    if (!payload)
      return c.json({ error: "Invalid or expired token" }, 401);

    const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
    if (!user)
      return c.json({ error: "User not found" }, 404);

    return c.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  });
