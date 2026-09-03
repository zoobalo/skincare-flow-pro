import { Hono } from "hono";
import { resolveTeamId } from "../../lib/resolve-team.ts";
import type { JWTPayload } from "../auth/jwt.ts";
import { getForecast } from "./queries.ts";
import {
  pushSalesTemplate, pushStockTemplate, pullSales, pullStock, weekEndingOf,
} from "./sheet-service.ts";
import { SALES_PLATFORMS } from "./constants.ts";

/** Surfaces a missing-script-URL as a clear 503 rather than a generic 500. */
const asMessage = (err: unknown) =>
  err instanceof Error ? err.message : "Sheet request failed";

export const forecastRoutes = new Hono()
  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "forecast");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    return c.json({
      rows: await getForecast(teamId),
      platforms: SALES_PLATFORMS,
      currentWeekEnding: weekEndingOf(),
    });
  })

  // ── Sales sheet ────────────────────────────────────────────────────────────
  .post("/sales/template", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "forecast");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const body = await c.req.json().catch(() => ({}));
    const weekEnding = typeof body.weekEnding === "string" && body.weekEnding
      ? body.weekEnding : weekEndingOf();
    try {
      return c.json(await pushSalesTemplate(teamId, weekEnding));
    } catch (err) {
      return c.json({ error: asMessage(err) }, 503);
    }
  })
  .post("/sales/import", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "forecast");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const body = await c.req.json().catch(() => ({}));
    const weekEnding = typeof body.weekEnding === "string" && body.weekEnding
      ? body.weekEnding : weekEndingOf();
    try {
      return c.json(await pullSales(teamId, weekEnding, user.name ?? null));
    } catch (err) {
      return c.json({ error: asMessage(err) }, 503);
    }
  })

  // ── Stock sheet ────────────────────────────────────────────────────────────
  .post("/stock/template", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "forecast");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    try {
      return c.json(await pushStockTemplate(teamId));
    } catch (err) {
      return c.json({ error: asMessage(err) }, 503);
    }
  })
  .post("/stock/import", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "forecast");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    try {
      return c.json(await pullStock(teamId));
    } catch (err) {
      return c.json({ error: asMessage(err) }, 503);
    }
  });
