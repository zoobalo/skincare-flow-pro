import { Hono } from "hono";
import { getAllShipments, getShipmentById } from "./queries.ts";
import type { JWTPayload } from "../auth/jwt.ts";

export const shipmentRoutes = new Hono()
  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const data = await getAllShipments(user.teamId);
    return c.json(data);
  })
  .get("/:id", async (c) => {
    const data = await getShipmentById(c.req.param("id"));
    if (!data) return c.json({ error: "Shipment not found" }, 404);
    return c.json(data);
  });
