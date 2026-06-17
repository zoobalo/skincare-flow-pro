import { Hono } from "hono";
import { getAllCouriers, createCourier, updateCourier, deleteCourier } from "./queries.ts";
import { resolveTeamId } from "../../lib/resolve-team.ts";
import type { JWTPayload } from "../auth/jwt.ts";

export const courierRoutes = new Hono()
  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "courier");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    return c.json(await getAllCouriers(teamId));
  })
  .post("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "courier");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const body = await c.req.json();
    const [created] = await createCourier({ ...body, id: crypto.randomUUID(), teamId });
    return c.json(created, 201);
  })
  .patch("/:id", async (c) => {
    const body = await c.req.json();
    const [updated] = await updateCourier(c.req.param("id"), { ...body, updatedAt: new Date() });
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })
  .delete("/:id", async (c) => {
    const [deleted] = await deleteCourier(c.req.param("id"));
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
