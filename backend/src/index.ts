import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env } from "./config/env.ts";
import { vendorRoutes } from "./modules/vendors/routes.ts";
import { manufacturerRoutes } from "./modules/manufacturers/routes.ts";
import { skuRoutes } from "./modules/skus/routes.ts";
import { skuItemRoutes } from "./modules/skus/item-routes.ts";
import { purchaseOrderRoutes } from "./modules/purchase-orders/routes.ts";
import { productionRoutes } from "./modules/production/routes.ts";
import { shipmentRoutes } from "./modules/shipments/routes.ts";
import { inventoryRoutes } from "./modules/inventory/routes.ts";
import { dashboardRoutes } from "./modules/dashboard/routes.ts";
import { userRoutes } from "./modules/users/routes.ts";
import { procurementRoutes } from "./modules/procurement/routes.ts";

const app = new Hono().basePath("/api");

app.use(
  "*",
  cors({ origin: (origin) => (origin?.startsWith("http://localhost") ? origin : null) })
);
app.use("*", logger());

app.get("/health", (c) => c.json({ ok: true, timestamp: new Date().toISOString() }));

app.route("/vendors",        vendorRoutes);
app.route("/manufacturers",  manufacturerRoutes);
app.route("/skus",           skuRoutes);
app.route("/skus",           skuItemRoutes);
app.route("/purchase-orders", purchaseOrderRoutes);
app.route("/production",     productionRoutes);
app.route("/shipments",      shipmentRoutes);
app.route("/inventory",      inventoryRoutes);
app.route("/dashboard",      dashboardRoutes);
app.route("/users",          userRoutes);
app.route("/procurement",    procurementRoutes);

serve({ fetch: app.fetch, port: env.PORT }, () => {
  console.log(`🚀  SkinOps API running on http://localhost:${env.PORT}/api`);
});
