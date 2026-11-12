import { Hono } from "hono";
import { resolveTeamId } from "../../lib/resolve-team.ts";
import type { JWTPayload } from "../auth/jwt.ts";
import { db } from "../../db/client.ts";
import { forecastRows, forecastMeta } from "../../db/schema/forecast-sheet.ts";
import { importForecastSheet } from "./sheet-import.ts";
import { eq, asc } from "drizzle-orm";
import { getForecast } from "./queries.ts";
import {
  pushSalesTemplate, pushStockTemplate, pullSales, pullStock, todayISO,
} from "./sheet-service.ts";
import { SALES_PLATFORMS } from "./constants.ts";

/** Surfaces a missing-script-URL as a clear 503 rather than a generic 500. */
const asMessage = (err: unknown) =>
  err instanceof Error ? err.message : "Sheet request failed";

export const forecastRoutes = new Hono()
  // ── The spreadsheet snapshot ──────────────────────────────────────────────
  .get("/sheet", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const [rows, [meta]] = await Promise.all([
      db.select().from(forecastRows)
        .where(eq(forecastRows.teamId, user.teamId))
        .orderBy(asc(forecastRows.position)),
      db.select().from(forecastMeta).where(eq(forecastMeta.teamId, user.teamId)).limit(1),
    ]);
    return c.json({ rows, meta: meta ?? null });
  })

  .post("/sheet/import", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    try {
      return c.json(await importForecastSheet(user.teamId, user.name ?? ""));
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "Import failed" }, 502);
    }
  })

  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "forecast");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const { rows, recentWeeks } = await getForecast(teamId);
    return c.json({
      rows,
      recentWeeks,
      platforms: SALES_PLATFORMS,
      currentWeekEnding: todayISO(),
    });
  })

  // ── Sales sheet ────────────────────────────────────────────────────────────
  .post("/sales/template", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "forecast");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const body = await c.req.json().catch(() => ({}));
    const weekEnding = typeof body.weekEnding === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.weekEnding)
      ? body.weekEnding
      : todayISO();
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
    const weekEnding = typeof body.weekEnding === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.weekEnding)
      ? body.weekEnding
      : todayISO();
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
