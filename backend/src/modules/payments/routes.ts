import { Hono } from "hono";
import { db } from "../../db/client.ts";
import { paymentTerms, paymentInvoices } from "../../db/schema/payments.ts";
import { vendors } from "../../db/schema/vendors.ts";
import { manufacturers } from "../../db/schema/manufacturers.ts";
import { eq, and, desc } from "drizzle-orm";
import type { JWTPayload } from "../auth/jwt.ts";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const day = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const int = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
};

const QC     = new Set(["Done", "Pending"]);
const GO     = new Set(["Go", "Stop"]);
const PAYING = new Set(["Pending", "Conveyed to accounts team", "Completed"]);

/** Everyone who can send us an invoice, both kinds in one list. */
async function parties(teamId: string) {
  const [v, m] = await Promise.all([
    db.select({ id: vendors.id, name: vendors.name }).from(vendors).where(eq(vendors.teamId, teamId)),
    db.select({ id: manufacturers.id, name: manufacturers.name }).from(manufacturers).where(eq(manufacturers.teamId, teamId)),
  ]);
  return [
    ...m.map((x) => ({ ...x, type: "Manufacturer" as const })),
    ...v.map((x) => ({ ...x, type: "Vendor" as const })),
  ].sort((a, b) => a.name.localeCompare(b.name));
}

export const paymentRoutes = new Hono()
  // ── Credit days ───────────────────────────────────────────────────────────
  // Every party is returned, with or without a term, so the tab is the full
  // list to fill in rather than only what somebody has already filled.
  .get("/terms", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const [all, terms] = await Promise.all([
      parties(user.teamId),
      db.select().from(paymentTerms).where(eq(paymentTerms.teamId, user.teamId)),
    ]);
    const byParty = new Map(terms.map((t) => [`${t.partyType}:${t.partyId}`, t.creditDays]));
    return c.json(all.map((p) => ({
      partyId: p.id, partyName: p.name, partyType: p.type,
      creditDays: byParty.get(`${p.type}:${p.id}`) ?? null,
    })));
  })

  .put("/terms", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const { partyId, partyType, creditDays } = await c.req.json();
    if (!partyId || !partyType) return c.json({ error: "Party is required" }, 400);

    const [existing] = await db.select().from(paymentTerms).where(and(
      eq(paymentTerms.teamId, user.teamId),
      eq(paymentTerms.partyType, partyType),
      eq(paymentTerms.partyId, partyId),
    )).limit(1);

    const days = int(creditDays);
    if (existing) {
      const [updated] = await db.update(paymentTerms)
        .set({ creditDays: days, updatedAt: new Date() })
        .where(eq(paymentTerms.id, existing.id)).returning();
      return c.json(updated);
    }
    const [created] = await db.insert(paymentTerms).values({
      id: crypto.randomUUID(), teamId: user.teamId, partyType, partyId, creditDays: days,
    }).returning();
    return c.json(created, 201);
  })

  // ── Invoices ──────────────────────────────────────────────────────────────
  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const [rows, all] = await Promise.all([
      db.select().from(paymentInvoices)
        .where(eq(paymentInvoices.teamId, user.teamId))
        .orderBy(desc(paymentInvoices.invoiceDate), desc(paymentInvoices.createdAt)),
      parties(user.teamId),
    ]);
    const name = new Map(all.map((p) => [`${p.type}:${p.id}`, p.name]));
    return c.json(rows.map((r) => ({
      ...r,
      partyName: name.get(`${r.partyType}:${r.partyId}`) ?? "",
    })));
  })

  .post("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const b = await c.req.json();
    if (!str(b.partyId) || !str(b.partyType)) return c.json({ error: "Choose the vendor or manufacturer" }, 400);
    if (!str(b.invoiceNumber))                return c.json({ error: "Invoice number is required" }, 400);
    if (!day(b.invoiceDate))                  return c.json({ error: "Invoice date is required" }, 400);

    const [created] = await db.insert(paymentInvoices).values({
      id:            crypto.randomUUID(),
      teamId:        user.teamId,
      partyType:     str(b.partyType),
      partyId:       str(b.partyId),
      invoiceNumber: str(b.invoiceNumber),
      invoiceDate:   day(b.invoiceDate),
      dueDays:       int(b.dueDays),
      internalQc:    QC.has(str(b.internalQc))     ? str(b.internalQc)     : "Pending",
      externalQc:    QC.has(str(b.externalQc))     ? str(b.externalQc)     : "Pending",
      finalStatus:   GO.has(str(b.finalStatus))    ? str(b.finalStatus)    : "Stop",
      paymentStatus: PAYING.has(str(b.paymentStatus)) ? str(b.paymentStatus) : "Pending",
      comments:      str(b.comments),
      createdById:   user.sub,
      createdByName: user.name ?? "",
    }).returning();
    return c.json(created, 201);
  })

  .patch("/:id", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const [row] = await db.select().from(paymentInvoices)
      .where(eq(paymentInvoices.id, c.req.param("id"))).limit(1);
    if (!row) return c.json({ error: "Not found" }, 404);
    if (row.teamId !== user.teamId) return c.json({ error: "Forbidden" }, 403);

    const b = await c.req.json();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (b.partyId       !== undefined) patch.partyId       = str(b.partyId);
    if (b.partyType     !== undefined) patch.partyType     = str(b.partyType);
    if (b.invoiceNumber !== undefined) patch.invoiceNumber = str(b.invoiceNumber);
    if (b.invoiceDate   !== undefined) patch.invoiceDate   = day(b.invoiceDate);
    if (b.dueDays       !== undefined) patch.dueDays       = int(b.dueDays);
    if (b.comments      !== undefined) patch.comments      = str(b.comments);

    for (const [k, allowed] of [["internalQc", QC], ["externalQc", QC],
                                ["finalStatus", GO], ["paymentStatus", PAYING]] as const) {
      if (b[k] === undefined) continue;
      if (!allowed.has(str(b[k]))) return c.json({ error: `${str(b[k])} is not a valid ${k}` }, 400);
      patch[k] = str(b[k]);
    }

    const [updated] = await db.update(paymentInvoices).set(patch)
      .where(eq(paymentInvoices.id, row.id)).returning();
    return c.json(updated);
  })

  .delete("/:id", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const [row] = await db.select().from(paymentInvoices)
      .where(eq(paymentInvoices.id, c.req.param("id"))).limit(1);
    if (!row) return c.json({ error: "Not found" }, 404);
    if (row.teamId !== user.teamId) return c.json({ error: "Forbidden" }, 403);
    await db.delete(paymentInvoices).where(eq(paymentInvoices.id, row.id));
    return c.json({ ok: true });
  });
