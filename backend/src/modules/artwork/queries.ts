import { db } from "../../db/client.ts";
import { artworkItems } from "../../db/schema/artwork.ts";
import { eq } from "drizzle-orm";

export const getAllArtwork = () =>
  db.select().from(artworkItems).orderBy(artworkItems.skuName, artworkItems.artworkType);

export const createArtwork = (data: typeof artworkItems.$inferInsert) =>
  db.insert(artworkItems).values(data).returning();

export const updateArtwork = (id: string, data: Partial<typeof artworkItems.$inferInsert>) =>
  db.update(artworkItems).set(data).where(eq(artworkItems.id, id)).returning();

export const deleteArtwork = (id: string) =>
  db.delete(artworkItems).where(eq(artworkItems.id, id)).returning();
