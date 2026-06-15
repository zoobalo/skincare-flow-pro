import { Hono } from "hono";
import { getInventorySummary, getPackagingInventory, getRawMaterialsInventory } from "./queries.ts";
import type { JWTPayload } from "../auth/jwt.ts";

export const inventoryRoutes = new Hono()
  .get("/summary", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const data = await getInventorySummary(user.teamId);
    return c.json(data);
  })
  .get("/packaging", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const data = await getPackagingInventory(user.teamId);
    return c.json(data);
  })
  .get("/raw-materials", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const data = await getRawMaterialsInventory(user.teamId);
    return c.json(data);
  });
