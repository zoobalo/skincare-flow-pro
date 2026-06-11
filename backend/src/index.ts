import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
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
import { uploadRoutes } from "./modules/upload/routes.ts";
import { taskRoutes } from "./modules/tasks/routes.ts";
import { npdRoutes } from "./modules/npd/routes.ts";
import { productionRemarkRoutes } from "./modules/production-remarks/routes.ts";
import { directoryRoutes } from "./modules/directory/routes.ts";
import { followUpRoutes } from "./modules/follow-ups/routes.ts";
import { artworkRoutes } from "./modules/artwork/routes.ts";
import { mftRoutes } from "./modules/mft/routes.ts";
import { courierRoutes } from "./modules/couriers/routes.ts";
import { impLinkRoutes } from "./modules/imp-links/routes.ts";
import { authRoutes } from "./modules/auth/routes.ts";
import { requireAuth } from "./modules/auth/middleware.ts";

const root = new Hono();

root.use("/uploads/*", serveStatic({ root: "./public" }));

const app = root.basePath("/api");

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return null;
      if (origin.startsWith("http://localhost")) return origin;
      if (ALLOWED_ORIGINS.includes(origin)) return origin;
      return null;
    },
  })
);
app.use("*", logger());

app.get("/health", (c) => c.json({ ok: true, timestamp: new Date().toISOString() }));

// Public routes (no token required)
app.route("/auth",   authRoutes);
app.route("/upload", uploadRoutes);

// All other routes require a valid JWT
app.use("*", requireAuth);

app.route("/vendors",            vendorRoutes);
app.route("/manufacturers",      manufacturerRoutes);
app.route("/skus",               skuRoutes);
app.route("/skus",               skuItemRoutes);
app.route("/purchase-orders",    purchaseOrderRoutes);
app.route("/production",         productionRoutes);
app.route("/shipments",          shipmentRoutes);
app.route("/inventory",          inventoryRoutes);
app.route("/dashboard",          dashboardRoutes);
app.route("/users",              userRoutes);
app.route("/procurement",        procurementRoutes);
app.route("/tasks",              taskRoutes);
app.route("/npd",                npdRoutes);
app.route("/production-remarks", productionRemarkRoutes);
app.route("/directory",          directoryRoutes);
app.route("/follow-ups",         followUpRoutes);
app.route("/artwork",            artworkRoutes);
app.route("/mft",               mftRoutes);
app.route("/couriers",          courierRoutes);
app.route("/imp-links",         impLinkRoutes);

serve({ fetch: root.fetch, port: env.PORT }, () => {
  console.log(`🚀  Zoobalo API running on http://localhost:${env.PORT}/api`);
});
