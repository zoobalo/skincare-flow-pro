import { db } from "../../db/client.ts";
import { npdQuoteRequests, npdQuotes } from "../../db/schema/npd-quotes.ts";
import { npd } from "../../db/schema/npd.ts";
import { and, eq, desc } from "drizzle-orm";

export type QuoteKind = "RM" | "PM";
export const isQuoteKind = (v: string): v is QuoteKind => v === "RM" || v === "PM";

/** URL-safe token for the public link. */
export function newToken() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

export const getRequestsForNpd = (npdId: string) =>
  db.query.npdQuoteRequests.findMany({
    where: (r, { eq }) => eq(r.npdId, npdId),
    with: { quotes: { orderBy: (q, { desc }) => [desc(q.submittedAt)] } },
  });

export const getRequestsForTeam = (teamId: string) =>
  db.query.npdQuoteRequests.findMany({
    where: (r, { eq }) => eq(r.teamId, teamId),
    with: { quotes: { orderBy: (q, { desc }) => [desc(q.submittedAt)] } },
  });

export const findRequest = (npdId: string, kind: QuoteKind) =>
  db.query.npdQuoteRequests.findFirst({
    where: (r, { and, eq }) => and(eq(r.npdId, npdId), eq(r.kind, kind)),
    with: { quotes: { orderBy: (q, { desc }) => [desc(q.submittedAt)] } },
  });

export const createRequest = (row: typeof npdQuoteRequests.$inferInsert) =>
  db.insert(npdQuoteRequests).values(row).returning();

export const updateRequest = (id: string, data: Partial<typeof npdQuoteRequests.$inferInsert>) =>
  db.update(npdQuoteRequests).set({ ...data, updatedAt: new Date() })
    .where(eq(npdQuoteRequests.id, id)).returning();

export const deleteRequest = (id: string) =>
  db.delete(npdQuoteRequests).where(eq(npdQuoteRequests.id, id)).returning();

/** Public lookup by token — also pulls the NPD name to show the vendor. */
export async function getByToken(token: string) {
  const [row] = await db
    .select({
      id: npdQuoteRequests.id,
      kind: npdQuoteRequests.kind,
      brief: npdQuoteRequests.brief,
      images: npdQuoteRequests.images,
      status: npdQuoteRequests.status,
      npdName: npd.name,
    })
    .from(npdQuoteRequests)
    .innerJoin(npd, eq(npdQuoteRequests.npdId, npd.id))
    .where(eq(npdQuoteRequests.token, token))
    .limit(1);
  return row ?? null;
}

export const addQuote = (row: typeof npdQuotes.$inferInsert) =>
  db.insert(npdQuotes).values(row).returning();

export const deleteQuote = (id: string) =>
  db.delete(npdQuotes).where(eq(npdQuotes.id, id)).returning();

/** Owning team of a quote, so deletes authorise against the parent request. */
export async function getQuoteTeam(quoteId: string) {
  const [row] = await db
    .select({ teamId: npdQuoteRequests.teamId })
    .from(npdQuotes)
    .innerJoin(npdQuoteRequests, eq(npdQuotes.requestId, npdQuoteRequests.id))
    .where(eq(npdQuotes.id, quoteId))
    .limit(1);
  return row ?? null;
}
