import { Hono } from "hono";
import { getAllArtwork, createArtwork, updateArtwork, deleteArtwork } from "./queries.ts";
import { db } from "../../db/client.ts";
import { artworkComments } from "../../db/schema/artwork-comments.ts";
import { eq, asc } from "drizzle-orm";
import { resolveTeamId } from "../../lib/resolve-team.ts";
import type { JWTPayload } from "../auth/jwt.ts";

export const artworkRoutes = new Hono()
  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "artwork");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    return c.json(await getAllArtwork(teamId));
  })
  .post("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "artwork");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const { statusUpdatedAt, ...rest } = await c.req.json();
    const data = {
      ...rest,
      id: crypto.randomUUID(),
      teamId,
      ...(statusUpdatedAt ? { statusUpdatedAt: new Date(statusUpdatedAt) } : {}),
    };
    const [created] = await createArtwork(data);
    return c.json(created, 201);
  })
  .patch("/:id", async (c) => {
    const { statusUpdatedAt, ...rest } = await c.req.json();
    const data = {
      ...rest,
      updatedAt: new Date(),
      ...(statusUpdatedAt !== undefined
        ? { statusUpdatedAt: statusUpdatedAt ? new Date(statusUpdatedAt) : null }
        : {}),
    };
    const [updated] = await updateArtwork(c.req.param("id"), data);
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })
  .delete("/:id", async (c) => {
    const [deleted] = await deleteArtwork(c.req.param("id"));
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  })
  // ── Comments ────────────────────────────────────────────────────────────────
  .get("/:id/comments", async (c) => {
    const comments = await db
      .select()
      .from(artworkComments)
      .where(eq(artworkComments.artworkId, c.req.param("id")))
      .orderBy(asc(artworkComments.createdAt));
    return c.json(comments);
  })
  .post("/:id/comments", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const { text } = await c.req.json();
    if (!text?.trim()) return c.json({ error: "Comment text is required" }, 400);
    const [comment] = await db
      .insert(artworkComments)
      .values({
        id:         crypto.randomUUID(),
        artworkId:  c.req.param("id"),
        text:       text.trim(),
        authorName: user.name,
        teamId:     user.teamId,
      })
      .returning();
    return c.json(comment, 201);
  })
  .delete("/:id/comments/:commentId", async (c) => {
    const [deleted] = await db
      .delete(artworkComments)
      .where(eq(artworkComments.id, c.req.param("commentId")))
      .returning();
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
