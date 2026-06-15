import { Hono } from "hono";
import { getAllManufacturers, getManufacturerById, createManufacturer, updateManufacturer, deleteManufacturer } from "./queries.ts";
import { db } from "../../db/client.ts";
import { skus } from "../../db/schema/skus.ts";
import { productionBatches } from "../../db/schema/production.ts";
import { eq, count } from "drizzle-orm";
import type { JWTPayload } from "../auth/jwt.ts";

export const manufacturerRoutes = new Hono()
  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const data = await getAllManufacturers(user.teamId);
    return c.json(data);
  })
  .get("/:id", async (c) => {
    const data = await getManufacturerById(c.req.param("id"));
    if (!data) return c.json({ error: "Manufacturer not found" }, 404);
    return c.json(data);
  })
  .post("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const body = await c.req.json();
    const [created] = await createManufacturer({ ...body, id: crypto.randomUUID(), teamId: user.teamId });
    return c.json(created, 201);
  })
  .patch("/:id", async (c) => {
    try {
      const body = await c.req.json();
      const { name, location, city, email, gst, pan, contactPerson, mobile, capacityPerMonth, qcPassRate, leadTimeDays, paymentTerms, rating, reliability, delayPercent, contacts } = body;
      const [updated] = await updateManufacturer(c.req.param("id"), { name, location, city, email, gst, pan, contactPerson, mobile, capacityPerMonth, qcPassRate, leadTimeDays, paymentTerms, rating, reliability, delayPercent, contacts });
      if (!updated) return c.json({ error: "Manufacturer not found" }, 404);
      return c.json(updated);
    } catch (err: any) {
      console.error("PATCH /manufacturers/:id error:", err);
      return c.json({ error: err?.message ?? "Failed to update manufacturer" }, 500);
    }
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const [{ value: skuCount }] = await db.select({ value: count() }).from(skus).where(eq(skus.manufacturerId, id));
    if (skuCount > 0) return c.json({ error: `Cannot delete: ${skuCount} SKU(s) are linked to this manufacturer. Reassign or delete them first.` }, 409);
    const [{ value: batchCount }] = await db.select({ value: count() }).from(productionBatches).where(eq(productionBatches.manufacturerId, id));
    if (batchCount > 0) return c.json({ error: `Cannot delete: ${batchCount} production batch(es) are linked to this manufacturer. Delete them first.` }, 409);
    const [deleted] = await deleteManufacturer(id);
    if (!deleted) return c.json({ error: "Manufacturer not found" }, 404);
    return c.json({ ok: true });
  });
