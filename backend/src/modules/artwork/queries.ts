import { db } from "../../db/client.ts";
import { artworkEntries, artworkSections, artworkLinks } from "../../db/schema/artwork.ts";
import { and, eq, max } from "drizzle-orm";

export const getAllArtwork = (teamId: string) =>
  db.query.artworkEntries.findMany({
    where: (a, { eq }) => eq(a.teamId, teamId),
    orderBy: (a, { asc }) => [asc(a.createdAt)],
    with: {
      sku: { columns: { id: true, name: true, code: true } },
      sections: { orderBy: (s, { asc }) => [asc(s.sortOrder), asc(s.createdAt)] },
      links: true,
    },
  });

export const getArtwork = (id: string) =>
  db.query.artworkEntries.findFirst({
    where: (a, { eq }) => eq(a.id, id),
    with: {
      sku: { columns: { id: true, name: true, code: true } },
      sections: { orderBy: (s, { asc }) => [asc(s.sortOrder), asc(s.createdAt)] },
      links: true,
    },
  });

export const createArtwork = (data: typeof artworkEntries.$inferInsert) =>
  db.insert(artworkEntries).values(data).returning();

export const updateArtwork = (id: string, data: Partial<typeof artworkEntries.$inferInsert>) =>
  db.update(artworkEntries).set(data).where(eq(artworkEntries.id, id)).returning();

export const deleteArtwork = (id: string) =>
  db.delete(artworkEntries).where(eq(artworkEntries.id, id)).returning();

export const createSections = (rows: (typeof artworkSections.$inferInsert)[]) =>
  db.insert(artworkSections).values(rows).returning();

export const updateSection = (id: string, data: Partial<typeof artworkSections.$inferInsert>) =>
  db.update(artworkSections).set(data).where(eq(artworkSections.id, id)).returning();

export const deleteSection = (id: string) =>
  db.delete(artworkSections).where(eq(artworkSections.id, id)).returning();

export const deleteSectionsFor = (artworkId: string) =>
  db.delete(artworkSections).where(eq(artworkSections.artworkId, artworkId));

export async function nextSortOrder(artworkId: string) {
  const [row] = await db
    .select({ m: max(artworkSections.sortOrder) })
    .from(artworkSections)
    .where(eq(artworkSections.artworkId, artworkId));
  return (row?.m ?? -1) + 1;
}

/** Owning team of a section, so section writes authorise against the parent. */
export async function getSectionTeam(sectionId: string) {
  const [row] = await db
    .select({ teamId: artworkEntries.teamId })
    .from(artworkSections)
    .innerJoin(artworkEntries, eq(artworkSections.artworkId, artworkEntries.id))
    .where(eq(artworkSections.id, sectionId))
    .limit(1);
  return row ?? null;
}

// ── Links ────────────────────────────────────────────────────────────────────

/** Saves one link, replacing whatever was there and re-stamping the author. */
export const upsertLink = (row: typeof artworkLinks.$inferInsert) =>
  db.insert(artworkLinks).values(row)
    .onConflictDoUpdate({
      target: [artworkLinks.artworkId, artworkLinks.kind],
      set: {
        url: row.url,
        updatedById: row.updatedById ?? null,
        updatedByName: row.updatedByName ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

export const deleteLink = (artworkId: string, kind: string) =>
  db.delete(artworkLinks)
    .where(and(eq(artworkLinks.artworkId, artworkId), eq(artworkLinks.kind, kind)))
    .returning();
