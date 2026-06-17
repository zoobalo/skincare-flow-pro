import { Hono } from "hono";
import { db } from "../../db/client.ts";
import { moduleGrants } from "../../db/schema/module-grants.ts";
import { users } from "../../db/schema/users.ts";
import { teams } from "../../db/schema/teams.ts";
import { and, eq, ne, inArray } from "drizzle-orm";
import type { JWTPayload } from "../auth/jwt.ts";

export const sharesRoutes = new Hono()

  // ── List shares I have created for my team ──────────────────────────────────
  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const grants = await db.select().from(moduleGrants)
      .where(eq(moduleGrants.ownerTeamId, user.teamId));
    if (!grants.length) return c.json([]);
    const granteeIds = [...new Set(grants.map((g) => g.granteeUserId))];
    const granteeUsers = await db
      .select({ id: users.id, name: users.name, email: users.email, department: users.department })
      .from(users)
      .where(inArray(users.id, granteeIds));
    const userMap = Object.fromEntries(granteeUsers.map((u) => [u.id, u]));
    return c.json(grants.map((g) => ({
      ...g,
      granteeName:  userMap[g.granteeUserId]?.name  ?? "",
      granteeEmail: userMap[g.granteeUserId]?.email ?? "",
    })));
  })

  // ── List grants given TO me (from other teams) ───────────────────────────────
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

  // ── Create a share ───────────────────────────────────────────────────────────
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

  // ── Delete a share ───────────────────────────────────────────────────────────
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

  // ── List active users from other teams (for share picker) ───────────────────
  .get("/available-users", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const others = await db
      .select({ id: users.id, name: users.name, email: users.email, department: users.department, teamId: users.teamId })
      .from(users)
      .where(and(ne(users.teamId, user.teamId), eq(users.status, "Active")));
    // Enrich with team names
    const teamIds = [...new Set(others.map((u) => u.teamId))];
    const allTeams = teamIds.length
      ? await db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, teamIds))
      : [];
    const teamMap = Object.fromEntries(allTeams.map((t) => [t.id, t.name]));
    return c.json(others.map((u) => ({ ...u, teamName: teamMap[u.teamId] ?? u.teamId })));
  });
