import { Hono } from "hono";
import { db } from "../../db/client.ts";
import { moduleGrants } from "../../db/schema/module-grants.ts";
import { userGrants } from "../../db/schema/user-grants.ts";
import { users } from "../../db/schema/users.ts";
import { teams } from "../../db/schema/teams.ts";
import { and, eq, ne, inArray } from "drizzle-orm";
import type { JWTPayload } from "../auth/jwt.ts";

export const sharesRoutes = new Hono()

  // ── List team module grants I created ────────────────────────────────────────
  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const grants = await db.select().from(moduleGrants)
      .where(eq(moduleGrants.ownerTeamId, user.teamId));
    if (!grants.length) return c.json([]);
    const granteeIds = [...new Set(grants.map((g) => g.granteeUserId))];
    const granteeUsers = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.id, granteeIds));
    const userMap = Object.fromEntries(granteeUsers.map((u) => [u.id, u]));
    return c.json(grants.map((g) => ({
      ...g,
      granteeName:  userMap[g.granteeUserId]?.name  ?? "",
      granteeEmail: userMap[g.granteeUserId]?.email ?? "",
    })));
  })

  // ── List team grants given TO me (from other teams) ───────────────────────────
  .get("/my-grants", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const grants = await db.select().from(moduleGrants)
      .where(eq(moduleGrants.granteeUserId, user.sub));
    if (!grants.length) return c.json([]);
    const teamIds = [...new Set(grants.map((g) => g.ownerTeamId))];
    const ownerTeams = await db
      .select({ id: teams.id, name: teams.name, department: teams.department })
      .from(teams)
      .where(inArray(teams.id, teamIds));
    const teamMap = Object.fromEntries(ownerTeams.map((t) => [t.id, t]));
    return c.json(grants.map((g) => ({
      ...g,
      ownerTeamName: teamMap[g.ownerTeamId]?.name       ?? g.ownerTeamId,
      ownerDept:     teamMap[g.ownerTeamId]?.department ?? "",
    })));
  })

  // ── Create a team module grant ────────────────────────────────────────────────
  .post("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const { module, granteeUserId } = await c.req.json();
    if (!module || !granteeUserId)
      return c.json({ error: "module and granteeUserId are required" }, 400);

    const existing = await db.select().from(moduleGrants).where(
      and(
        eq(moduleGrants.module, module),
        eq(moduleGrants.ownerTeamId, user.teamId),
        eq(moduleGrants.granteeUserId, granteeUserId),
      ),
    ).limit(1);
    if (existing.length) return c.json({ error: "Share already exists" }, 409);

    const [grant] = await db.insert(moduleGrants).values({
      id:            crypto.randomUUID(),
      module,
      ownerTeamId:   user.teamId,
      granteeUserId,
      createdBy:     user.sub,
    }).returning();
    return c.json(grant, 201);
  })

  // ── Delete a team module grant ────────────────────────────────────────────────
  .delete("/:id", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const [deleted] = await db.delete(moduleGrants)
      .where(
        and(
          eq(moduleGrants.id, c.req.param("id")),
          eq(moduleGrants.ownerTeamId, user.teamId),
        ),
      )
      .returning();
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  })

  // ── List user grants I created for my personal modules ────────────────────────
  .get("/user-shares", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const grants = await db.select().from(userGrants)
      .where(eq(userGrants.ownerUserId, user.sub));
    if (!grants.length) return c.json([]);
    const granteeIds = [...new Set(grants.map((g) => g.granteeUserId))];
    const granteeUsers = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.id, granteeIds));
    const userMap = Object.fromEntries(granteeUsers.map((u) => [u.id, u]));
    return c.json(grants.map((g) => ({
      ...g,
      granteeName:  userMap[g.granteeUserId]?.name  ?? "",
      granteeEmail: userMap[g.granteeUserId]?.email ?? "",
    })));
  })

  // ── List user grants given TO me (personal data shared by others) ─────────────
  .get("/my-user-grants", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const grants = await db.select().from(userGrants)
      .where(eq(userGrants.granteeUserId, user.sub));
    if (!grants.length) return c.json([]);
    const ownerIds = [...new Set(grants.map((g) => g.ownerUserId))];
    const ownerUsers = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.id, ownerIds));
    const ownerMap = Object.fromEntries(ownerUsers.map((u) => [u.id, u]));
    return c.json(grants.map((g) => ({
      ...g,
      ownerUserName:  ownerMap[g.ownerUserId]?.name  ?? "",
      ownerUserEmail: ownerMap[g.ownerUserId]?.email ?? "",
    })));
  })

  // ── Create a user grant ────────────────────────────────────────────────────────
  .post("/user", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const { module, granteeUserId } = await c.req.json();
    if (!module || !granteeUserId)
      return c.json({ error: "module and granteeUserId are required" }, 400);
    if (granteeUserId === user.sub)
      return c.json({ error: "Cannot share with yourself" }, 400);

    const existing = await db.select().from(userGrants).where(
      and(
        eq(userGrants.module, module),
        eq(userGrants.ownerUserId, user.sub),
        eq(userGrants.granteeUserId, granteeUserId),
      ),
    ).limit(1);
    if (existing.length) return c.json({ error: "Share already exists" }, 409);

    const [grant] = await db.insert(userGrants).values({
      id:            crypto.randomUUID(),
      module,
      ownerUserId:   user.sub,
      granteeUserId,
      createdBy:     user.sub,
    }).returning();
    return c.json(grant, 201);
  })

  // ── Delete a user grant ────────────────────────────────────────────────────────
  .delete("/user/:id", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const [deleted] = await db.delete(userGrants)
      .where(
        and(
          eq(userGrants.id, c.req.param("id")),
          eq(userGrants.ownerUserId, user.sub),
        ),
      )
      .returning();
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  })

  // ── List users from other teams (for team module sharing) ─────────────────────
  .get("/available-users", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const others = await db
      .select({ id: users.id, name: users.name, email: users.email, department: users.department, teamId: users.teamId })
      .from(users)
      .where(and(ne(users.teamId, user.teamId), eq(users.status, "Active")));
    const teamIds = [...new Set(others.map((u) => u.teamId))];
    const allTeams = teamIds.length
      ? await db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, teamIds))
      : [];
    const teamMap = Object.fromEntries(allTeams.map((t) => [t.id, t.name]));
    return c.json(others.map((u) => ({ ...u, teamName: teamMap[u.teamId] ?? u.teamId })));
  })

  // ── List all active users except self (for personal module sharing) ────────────
  .get("/all-users", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const allActiveUsers = await db
      .select({ id: users.id, name: users.name, email: users.email, department: users.department, teamId: users.teamId })
      .from(users)
      .where(and(ne(users.id, user.sub), eq(users.status, "Active")));
    const teamIds = [...new Set(allActiveUsers.map((u) => u.teamId))];
    const allTeams = teamIds.length
      ? await db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, teamIds))
      : [];
    const teamMap = Object.fromEntries(allTeams.map((t) => [t.id, t.name]));
    return c.json(allActiveUsers.map((u) => ({ ...u, teamName: teamMap[u.teamId] ?? u.teamId })));
  });
