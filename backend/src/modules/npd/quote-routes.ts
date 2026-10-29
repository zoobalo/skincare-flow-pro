import { Hono } from "hono";
import { resolveTeamId } from "../../lib/resolve-team.ts";
import type { JWTPayload } from "../auth/jwt.ts";
import { db } from "../../db/client.ts";
import { npd } from "../../db/schema/npd.ts";
import { eq } from "drizzle-orm";
import {
  getRequestsForTeam, findRequest, createRequest, updateRequest, deleteRequest,
  deleteQuote, getQuoteTeam, newToken, isQuoteKind,
} from "./quote-queries.ts";

/** Authenticated side: create and manage requests, read the quotes received. */
export const npdQuoteRoutes = new Hono()

  /** Every request for the team, with its quotes — the dashboard reads this. */
  .get("/quote-requests", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "npd");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    return c.json(await getRequestsForTeam(teamId));
  })

  /**
   * Open (or update) the RM/PM request for one NPD. Idempotent: asking twice
   * returns the same link rather than invalidating one already sent out.
   */
  .post("/:npdId/quote-requests", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "npd");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);

    const [parent] = await db.select().from(npd).where(eq(npd.id, c.req.param("npdId"))).limit(1);
    if (!parent) return c.json({ error: "NPD not found" }, 404);
    if (parent.teamId !== teamId) return c.json({ error: "Forbidden" }, 403);

    const body = await c.req.json();
    const kind = String(body.kind ?? "");
    if (!isQuoteKind(kind)) return c.json({ error: "kind must be RM or PM" }, 400);
    const brief = typeof body.brief === "string" ? body.brief : "";
    const images = Array.isArray(body.images)
      ? body.images.filter((x: unknown): x is string => typeof x === "string").slice(0, 8)
      : [];

    const existing = await findRequest(parent.id, kind);
    if (existing) {
      const [updated] = await updateRequest(existing.id, { brief, images });
      return c.json({ ...updated, quotes: existing.quotes });
    }
    const [created] = await createRequest({
      id: crypto.randomUUID(), npdId: parent.id, kind, token: newToken(), brief, images, teamId,
    });
    return c.json({ ...created, quotes: [] }, 201);
  })

  /** Edit the brief, or open/close the request to new submissions. */
  .patch("/quote-requests/:requestId", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "npd");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);

    const existing = await db.query.npdQuoteRequests.findFirst({
      where: (r, { eq }) => eq(r.id, c.req.param("requestId")),
    });
    if (!existing) return c.json({ error: "Not found" }, 404);
    if (existing.teamId !== teamId) return c.json({ error: "Forbidden" }, 403);

    const body = await c.req.json();
    const data: Record<string, unknown> = {};
    if (typeof body.brief === "string") data.brief = body.brief;
    if (Array.isArray(body.images)) {
      data.images = body.images.filter((x: unknown): x is string => typeof x === "string").slice(0, 8);
    }
    if (body.status === "open" || body.status === "closed") data.status = body.status;
    // Rotating the token kills links already sent — only on explicit request.
    if (body.rotateToken === true) data.token = newToken();

    const [updated] = await updateRequest(existing.id, data);
    return c.json(updated);
  })

  .delete("/quote-requests/:requestId", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "npd");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const existing = await db.query.npdQuoteRequests.findFirst({
      where: (r, { eq }) => eq(r.id, c.req.param("requestId")),
    });
    if (!existing) return c.json({ error: "Not found" }, 404);
    if (existing.teamId !== teamId) return c.json({ error: "Forbidden" }, 403);
    await deleteRequest(existing.id);
    return c.json({ ok: true });
  })

  /** Remove one vendor's submission. */
  .delete("/quotes/:quoteId", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "npd");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const owner = await getQuoteTeam(c.req.param("quoteId"));
    if (!owner) return c.json({ error: "Not found" }, 404);
    if (owner.teamId !== teamId) return c.json({ error: "Forbidden" }, 403);
    await deleteQuote(c.req.param("quoteId"));
    return c.json({ ok: true });
  });
