import { Hono } from "hono";
import {
  getAllPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
} from "./queries.ts";
import { PO_STATUSES } from "../../db/schema/purchase-orders.ts";

export const purchaseOrderRoutes = new Hono()
  .get("/", async (c) => {
    const status   = c.req.query("status")   ?? undefined;
    const vendorId = c.req.query("vendorId") ?? undefined;
    const skuId    = c.req.query("skuId")    ?? undefined;
    const data = await getAllPurchaseOrders(status, vendorId, skuId);
    return c.json(data);
  })
  .get("/:id", async (c) => {
    const data = await getPurchaseOrderById(c.req.param("id"));
    if (!data) return c.json({ error: "Purchase order not found" }, 404);
    return c.json(data);
  })
  .post("/", async (c) => {
    const body = await c.req.json();
    const [created] = await createPurchaseOrder(body);
    return c.json(created, 201);
  })
  .patch("/:id/status", async (c) => {
    const { status } = await c.req.json<{ status: string }>();
    if (!PO_STATUSES.includes(status as any)) {
      return c.json({ error: `Invalid status. Must be one of: ${PO_STATUSES.join(", ")}` }, 400);
    }
    const [updated] = await updatePurchaseOrderStatus(c.req.param("id"), status as any);
    if (!updated) return c.json({ error: "Purchase order not found" }, 404);
    return c.json(updated);
  });
