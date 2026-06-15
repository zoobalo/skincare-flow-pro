import { Hono } from "hono";
import { getDashboardKpis } from "./queries.ts";
import type { JWTPayload } from "../auth/jwt.ts";

export const dashboardRoutes = new Hono()
  .get("/kpis", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const data = await getDashboardKpis(user.teamId);
    return c.json(data);
  });
