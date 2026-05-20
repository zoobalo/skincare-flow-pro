import { Hono } from "hono";
import { getAllUsers } from "./queries.ts";

export const userRoutes = new Hono()
  .get("/", async (c) => {
    const data = await getAllUsers();
    return c.json(data);
  });
