import { Hono } from "hono";
import { getInventorySummary, getPackagingInventory, getRawMaterialsInventory } from "./queries.ts";

export const inventoryRoutes = new Hono()
  .get("/summary", async (c) => {
    const data = await getInventorySummary();
    return c.json(data);
  })
  .get("/packaging", async (c) => {
    const data = await getPackagingInventory();
    return c.json(data);
  })
  .get("/raw-materials", async (c) => {
    const data = await getRawMaterialsInventory();
    return c.json(data);
  });
