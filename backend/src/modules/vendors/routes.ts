import { Hono } from "hono";
import { getAllVendors, getVendorById, createVendor, updateVendor, deleteVendor } from "./queries.ts";
import { db } from "../../db/client.ts";
import { purchaseOrders } from "../../db/schema/purchase-orders.ts";
import { eq, count } from "drizzle-orm";
import type { JWTPayload } from "../auth/jwt.ts";

export const vendorRoutes = new Hono()
  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const data = await getAllVendors(user.teamId);
    return c.json(data);
  })
  .get("/:id", async (c) => {
    const data = await getVendorById(c.req.param("id"));
    if (!data) return c.json({ error: "Vendor not found" }, 404);
    return c.json(data);
  })
  .post("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const body = await c.req.json();
    const [created] = await createVendor({
      ...body,
      id: crypto.randomUUID(),
      teamId: user.teamId,
      materials: Array.isArray(body.materials) ? body.materials : body.materials?.split(",").map((s: string) => s.trim()).filter(Boolean) ?? [],
    });
    return c.json(created, 201);
  })
  .patch("/:id", async (c) => {
    const body = await c.req.json();
    if (body.materials && !Array.isArray(body.materials)) {
      body.materials = body.materials.split(",").map((s: string) => s.trim()).filter(Boolean);
    }
    const [updated] = await updateVendor(c.req.param("id"), body);
    if (!updated) return c.json({ error: "Vendor not found" }, 404);
    return c.json(updated);
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const [{ value: poCount }] = await db.select({ value: count() }).from(purchaseOrders).where(eq(purchaseOrders.vendorId, id));
    if (poCount > 0) return c.json({ error: `Cannot delete: this vendor has ${poCount} purchase order(s). Delete or reassign them first.` }, 409);
    const [deleted] = await deleteVendor(id);
    if (!deleted) return c.json({ error: "Vendor not found" }, 404);
    return c.json({ ok: true });
  });
