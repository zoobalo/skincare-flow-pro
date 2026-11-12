import { Hono } from "hono";
import { db } from "../../db/client.ts";
import { receivings } from "../../db/schema/receivings.ts";
import { eq, desc } from "drizzle-orm";
import type { JWTPayload } from "../auth/jwt.ts";

/** Numeric columns arrive as strings or blanks; keep "" out of the database. */
const num = (v: unknown) =>
  v === "" || v === null || v === undefined ? null : String(v);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
/** A date column rejects ""; a cleared field has to become null. */
const day = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

const FIELDS = [
  "skuName", "partyName", "batchNo", "poNumber", "invoiceNumber",
  "mfgDate", "expDate", "coaStatus", "qc", "finalStatus", "comments",
] as const;
const NUMBERS = ["receivedQty", "poQty", "invoiceQty", "mrp"] as const;
const DATES = ["receivedDate", "poDate", "invoiceDate"] as const;

export const receivingRoutes = new Hono()
  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const rows = await db.select().from(receivings)
      .where(eq(receivings.teamId, user.teamId))
      .orderBy(desc(receivings.receivedDate), desc(receivings.createdAt));
    return c.json(rows);
  })

  // Names already used, so the form can suggest them without constraining.
  .get("/suggestions", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const rows = await db
      .select({ skuName: receivings.skuName, partyName: receivings.partyName })
      .from(receivings).where(eq(receivings.teamId, user.teamId));
    const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort();
    return c.json({
      skuNames:   uniq(rows.map((r) => r.skuName)),
      partyNames: uniq(rows.map((r) => r.partyName)),
    });
  })

  .post("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const body = await c.req.json();
    if (!str(body.skuName))   return c.json({ error: "SKU name is required" }, 400);
    if (!str(body.partyName)) return c.json({ error: "Party name is required" }, 400);

    const [created] = await db.insert(receivings).values({
      id:            crypto.randomUUID(),
      teamId:        user.teamId,
      skuName:       str(body.skuName),
      partyName:     str(body.partyName),
      batchNo:       str(body.batchNo),
      receivedQty:   num(body.receivedQty),
      receivedDate:  day(body.receivedDate),
      poNumber:      str(body.poNumber),
      poDate:        day(body.poDate),
      poQty:         num(body.poQty),
      invoiceNumber: str(body.invoiceNumber),
      invoiceDate:   day(body.invoiceDate),
      invoiceQty:    num(body.invoiceQty),
      mfgDate:       str(body.mfgDate),
      expDate:       str(body.expDate),
      mrp:           num(body.mrp),
      coaStatus:     str(body.coaStatus)   || "Pending",
      qc:            str(body.qc)          || "Pending",
      finalStatus:   str(body.finalStatus) || "Pending",
      comments:      str(body.comments),
      createdById:   user.sub,
      createdByName: user.name ?? "",
    }).returning();
    return c.json(created, 201);
  })

  .patch("/:id", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const [row] = await db.select().from(receivings)
      .where(eq(receivings.id, c.req.param("id"))).limit(1);
    if (!row) return c.json({ error: "Not found" }, 404);
    if (row.teamId !== user.teamId) return c.json({ error: "Forbidden" }, 403);

    const body = await c.req.json();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of FIELDS)  if (body[k] !== undefined) patch[k] = str(body[k]);
    for (const k of NUMBERS) if (body[k] !== undefined) patch[k] = num(body[k]);
    for (const k of DATES)   if (body[k] !== undefined) patch[k] = day(body[k]);

    const [updated] = await db.update(receivings).set(patch)
      .where(eq(receivings.id, row.id)).returning();
    return c.json(updated);
  })

  .delete("/:id", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const [row] = await db.select().from(receivings)
      .where(eq(receivings.id, c.req.param("id"))).limit(1);
    if (!row) return c.json({ error: "Not found" }, 404);
    if (row.teamId !== user.teamId) return c.json({ error: "Forbidden" }, 403);
    await db.delete(receivings).where(eq(receivings.id, row.id));
    return c.json({ ok: true });
  });
