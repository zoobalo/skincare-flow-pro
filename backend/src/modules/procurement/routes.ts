import { Hono } from "hono";
import { getMrpAlerts, getPendingApprovals, getDuePayments } from "./queries.ts";

export const procurementRoutes = new Hono()
  .get("/mrp-alerts", async (c) => {
    const data = await getMrpAlerts();
    return c.json(data);
  })
  .get("/pending-approvals", async (c) => {
    const data = await getPendingApprovals();
    return c.json(data);
  })
  .get("/due-payments", async (c) => {
    const data = await getDuePayments();
    return c.json(data);
  });
