import { Hono } from "hono";
import { compare, hash } from "bcryptjs";
import { db } from "../../db/client.ts";
import { users } from "../../db/schema/users.ts";
import { teams } from "../../db/schema/teams.ts";
import { eq } from "drizzle-orm";
import { signToken, verifyToken } from "./jwt.ts";
import { randomUUID } from "crypto";

export const authRoutes = new Hono()

  // ── POST /api/auth/signup ────────────────────────────────────────────────────
  .post("/signup", async (c) => {
    const { name, email, password, department } = await c.req.json();

    if (!name || !email || !password || !department)
      return c.json({ error: "name, email, password and department are required" }, 400);

    if (password.length < 8)
      return c.json({ error: "Password must be at least 8 characters" }, 400);

    const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (existing.length > 0)
      return c.json({ error: "An account with this email already exists" }, 409);

    // Find or create a team for this department
    let [team] = await db.select().from(teams).where(eq(teams.department, department)).limit(1);
    if (!team) {
      const label = department.charAt(0).toUpperCase() + department.slice(1);
      [team] = await db.insert(teams).values({
        id: randomUUID(),
        name: `${label} Team`,
        department,
      }).returning();
    }

    const allUsers = await db.select().from(users);
    const isFirstUser = allUsers.length === 0;

    const passwordHash = await hash(password, 10);
    const [user] = await db.insert(users).values({
      id:           randomUUID(),
      name:         name.trim(),
      email:        email.toLowerCase().trim(),
      role:         isFirstUser ? "Admin" : "Manager",
      // First-ever user is auto-approved; all subsequent users are Pending until admin approves
      status:       isFirstUser ? "Active" : "Pending",
      passwordHash,
      teamId:       team.id,
      department,
    }).returning();

    if (isFirstUser) {
      const token = await signToken({ sub: user.id, email: user.email, role: user.role, name: user.name, teamId: user.teamId, department: user.department });
      return c.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department } }, 201);
    }

    return c.json({ pending: true, message: "Your account request has been submitted. You will be able to log in once the admin approves your request." }, 201);
  })

  // ── POST /api/auth/login ─────────────────────────────────────────────────────
  .post("/login", async (c) => {
    const { email, password } = await c.req.json();

    if (!email || !password)
      return c.json({ error: "Email and password are required" }, 400);

    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (!user)
      return c.json({ error: "Invalid email or password" }, 401);

    const valid = await compare(password, user.passwordHash);
    if (!valid)
      return c.json({ error: "Invalid email or password" }, 401);

    if (user.status === "Pending")
      return c.json({ error: "Your account is pending approval. Please wait for the admin to approve your request." }, 403);

    if (user.status === "Rejected")
      return c.json({ error: "Your access request was not approved. Please contact the admin." }, 403);

    if (user.status === "Inactive")
      return c.json({ error: "Your account has been deactivated. Contact the admin." }, 403);

    const token = await signToken({ sub: user.id, email: user.email, role: user.role, name: user.name, teamId: user.teamId, department: user.department });
    return c.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department } });
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

    return c.json({ id: user.id, name: user.name, email: user.email, role: user.role, department: user.department, teamId: user.teamId });
  });
