import { Hono } from "hono";
import {
  getAllPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  updatePurchaseOrder,
  deletePurchaseOrder,
} from "./queries.ts";
import { PO_STATUSES } from "../../db/schema/purchase-orders.ts";
import type { JWTPayload } from "../auth/jwt.ts";

export const purchaseOrderRoutes = new Hono()
  .get("/", async (c) => {
    const user     = c.get("user" as never) as JWTPayload;
    const status   = c.req.query("status")   ?? undefined;
    const vendorId = c.req.query("vendorId") ?? undefined;
    const skuId    = c.req.query("skuId")    ?? undefined;
    const data = await getAllPurchaseOrders(user.teamId, status, vendorId, skuId);
    return c.json(data);
  })
  .get("/:id", async (c) => {
    const data = await getPurchaseOrderById(c.req.param("id"));
    if (!data) return c.json({ error: "Purchase order not found" }, 404);
    return c.json(data);
  })
  .post("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const body = await c.req.json();
    const [created] = await createPurchaseOrder({ ...body, teamId: user.teamId });
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
  })
  .patch("/:id", async (c) => {
    const body = await c.req.json();
    const [updated] = await updatePurchaseOrder(c.req.param("id"), body);
    if (!updated) return c.json({ error: "Purchase order not found" }, 404);
    return c.json(updated);
  })
  .delete("/:id", async (c) => {
    const [deleted] = await deletePurchaseOrder(c.req.param("id"));
    if (!deleted) return c.json({ error: "Purchase order not found" }, 404);
    return c.json({ ok: true });
  })
  .post("/sync-sheet", async (c) => {
    const scriptUrl = process.env.PO_APPS_SCRIPT_URL;
    if (!scriptUrl) return c.json({ error: "PO Sheets sync not configured — set PO_APPS_SCRIPT_URL on the server" }, 503);
    try {
      const { rows } = await c.req.json();
      const res  = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
        redirect: "follow",
      });
      const data = await res.json() as { success: boolean; url?: string; error?: string };
      if (!data.success) return c.json({ error: data.error ?? "Apps Script returned failure" }, 502);
      return c.json({ url: data.url });
    } catch (err: any) {
      return c.json({ error: err?.message ?? "Failed to reach Apps Script" }, 500);
    }
  });
