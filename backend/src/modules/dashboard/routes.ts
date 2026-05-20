import { Hono } from "hono";
import { getDashboardKpis } from "./queries.ts";

export const dashboardRoutes = new Hono()
  .get("/kpis", async (c) => {
    const data = await getDashboardKpis();
    return c.json(data);
  });
