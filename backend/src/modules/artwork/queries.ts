import { db } from "../../db/client.ts";
import { artworkSkus, artworkSections, artworkLibraryEntries } from "../../db/schema/artwork.ts";
import { and, eq, inArray, max } from "drizzle-orm";

// ── SKUs ─────────────────────────────────────────────────────────────────────

export const getAllSkus = (teamId: string) =>
  db.query.artworkSkus.findMany({
    where: (s, { eq }) => eq(s.teamId, teamId),
    orderBy: (s, { asc }) => [asc(s.skuName)],
    with: {
      sections: { orderBy: (x, { asc }) => [asc(x.sortOrder), asc(x.createdAt)] },
    },
  });

export const getSku = (id: string) =>
  db.query.artworkSkus.findFirst({
    where: (s, { eq }) => eq(s.id, id),
    with: {
      sections: { orderBy: (x, { asc }) => [asc(x.sortOrder), asc(x.createdAt)] },
    },
  });

export const createSku = (data: typeof artworkSkus.$inferInsert) =>
  db.insert(artworkSkus).values(data).returning();

export const updateSku = (id: string, data: Partial<typeof artworkSkus.$inferInsert>) =>
  db.update(artworkSkus).set(data).where(eq(artworkSkus.id, id)).returning();

export const deleteSku = (id: string) =>
  db.delete(artworkSkus).where(eq(artworkSkus.id, id)).returning();

// ── Sections ─────────────────────────────────────────────────────────────────

export const createSections = (rows: (typeof artworkSections.$inferInsert)[]) =>
  db.insert(artworkSections).values(rows).returning();

export const updateSection = (id: string, data: Partial<typeof artworkSections.$inferInsert>) =>
  db.update(artworkSections).set(data).where(eq(artworkSections.id, id)).returning();

export const deleteSection = (id: string) =>
  db.delete(artworkSections).where(eq(artworkSections.id, id)).returning();

export const getSectionsBySku = (skuId: string) =>
  db.select().from(artworkSections).where(eq(artworkSections.skuId, skuId));

/** Highest sortOrder currently used on a SKU, so appended rows land at the end. */
export async function nextSortOrder(skuId: string) {
  const [row] = await db
    .select({ m: max(artworkSections.sortOrder) })
    .from(artworkSections)
    .where(eq(artworkSections.skuId, skuId));
  return (row?.m ?? -1) + 1;
}

/**
 * Resolves the owning team of a section, so section-level writes can be
 * authorised against the parent SKU rather than trusting the caller.
 */
export async function getSectionTeam(sectionId: string) {
  const [row] = await db
    .select({ teamId: artworkSkus.teamId, skuId: artworkSkus.id })
    .from(artworkSections)
    .innerJoin(artworkSkus, eq(artworkSections.skuId, artworkSkus.id))
    .where(eq(artworkSections.id, sectionId))
    .limit(1);
  return row ?? null;
}

// ── Library ──────────────────────────────────────────────────────────────────

export const getLibrary = (teamId: string) =>
  db.select().from(artworkLibraryEntries)
    .where(eq(artworkLibraryEntries.teamId, teamId))
    .orderBy(artworkLibraryEntries.name);

export const getLibraryEntries = (teamId: string, ids: string[]) =>
  db.select().from(artworkLibraryEntries)
    .where(and(eq(artworkLibraryEntries.teamId, teamId), inArray(artworkLibraryEntries.id, ids)));

export const createLibraryEntry = (data: typeof artworkLibraryEntries.$inferInsert) =>
  db.insert(artworkLibraryEntries).values(data).returning();

export const updateLibraryEntry = (id: string, teamId: string, data: Partial<typeof artworkLibraryEntries.$inferInsert>) =>
  db.update(artworkLibraryEntries).set(data)
    .where(and(eq(artworkLibraryEntries.id, id), eq(artworkLibraryEntries.teamId, teamId)))
    .returning();

export const deleteLibraryEntry = (id: string, teamId: string) =>
  db.delete(artworkLibraryEntries)
    .where(and(eq(artworkLibraryEntries.id, id), eq(artworkLibraryEntries.teamId, teamId)))
    .returning();
