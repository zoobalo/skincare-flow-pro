import { Hono } from "hono";
import { getMrpAlerts, getPendingApprovals, getDuePayments } from "./queries.ts";
import type { JWTPayload } from "../auth/jwt.ts";

export const procurementRoutes = new Hono()
  .get("/mrp-alerts", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const data = await getMrpAlerts(user.teamId);
    return c.json(data);
  })
  .get("/pending-approvals", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const data = await getPendingApprovals(user.teamId);
    return c.json(data);
  })
  .get("/due-payments", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const data = await getDuePayments(user.teamId);
    return c.json(data);
  });
