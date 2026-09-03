import { Hono } from "hono";
import { resolveTeamId } from "../../lib/resolve-team.ts";
import type { JWTPayload } from "../auth/jwt.ts";
import {
  getAllArtwork, getArtwork, createArtwork, updateArtwork, deleteArtwork,
  createSections, updateSection, deleteSection, deleteSectionsFor,
  nextSortOrder, getSectionTeam,
} from "./queries.ts";

type SectionInput = { name: string; data: string };

const LINK_FIELDS = [
  "firstDraftLink",
  "manufacturerApprovalLink",
  "finalPrintingLink",
  "otherLink",
] as const;

/**
 * Pulls the link fields out of a payload, storing null for blanks and
 * prefixing a bare host with https:// so the Open button always resolves.
 */
function readLinks(body: Record<string, unknown>, onlyPresent = false) {
  const out: Record<string, string | null> = {};
  for (const key of LINK_FIELDS) {
    if (onlyPresent && body[key] === undefined) continue;
    const raw = typeof body[key] === "string" ? (body[key] as string).trim() : "";
    out[key] = raw ? (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`) : null;
  }
  return out;
}

/** Keeps only usable section rows — a blank name means the row was left empty. */
function readSections(raw: unknown): SectionInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => ({
      name: typeof s?.name === "string" ? s.name.trim() : "",
      data: typeof s?.data === "string" ? s.data : "",
    }))
    .filter((s) => s.name.length > 0);
}

export const artworkRoutes = new Hono()

  // ── Sections (registered first so "sections" is never read as an id) ───────
  .patch("/sections/:sectionId", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "artwork");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const owner = await getSectionTeam(c.req.param("sectionId"));
    if (!owner) return c.json({ error: "Not found" }, 404);
    if (owner.teamId !== teamId) return c.json({ error: "Forbidden" }, 403);

    const body = await c.req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return c.json({ error: "Section name is required" }, 400);
    const [updated] = await updateSection(c.req.param("sectionId"), {
      name,
      data: typeof body.data === "string" ? body.data : "",
      updatedAt: new Date(),
    });
    return c.json(updated);
  })
  .delete("/sections/:sectionId", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "artwork");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const owner = await getSectionTeam(c.req.param("sectionId"));
    if (!owner) return c.json({ error: "Not found" }, 404);
    if (owner.teamId !== teamId) return c.json({ error: "Forbidden" }, 403);
    await deleteSection(c.req.param("sectionId"));
    return c.json({ ok: true });
  })

  // ── Artwork entries ────────────────────────────────────────────────────────
  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "artwork");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    return c.json(await getAllArtwork(teamId));
  })

  /** Create an artwork and all its sections in one save. */
  .post("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "artwork");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);

    const body = await c.req.json();
    const skuId = typeof body.skuId === "string" ? body.skuId.trim() : "";
    const artworkType = typeof body.artworkType === "string" ? body.artworkType.trim() : "";
    if (!skuId) return c.json({ error: "Select a SKU" }, 400);
    if (!artworkType) return c.json({ error: "Choose an artwork type" }, 400);

    const sections = readSections(body.sections);
    if (!sections.length) return c.json({ error: "Add at least one section" }, 400);

    const id = crypto.randomUUID();
    try {
      await createArtwork({ id, skuId, artworkType, teamId, ...readLinks(body) });
    } catch {
      // The only realistic failure is a skuId that is not in the catalogue.
      return c.json({ error: "That SKU no longer exists" }, 400);
    }
    await createSections(sections.map((s, i) => ({
      id: crypto.randomUUID(), artworkId: id, name: s.name, data: s.data, sortOrder: i,
    })));
    return c.json(await getArtwork(id), 201);
  })

  /** Update type and/or replace the whole section list, matching the edit form. */
  .patch("/:id", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "artwork");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const existing = await getArtwork(c.req.param("id"));
    if (!existing) return c.json({ error: "Not found" }, 404);
    if (existing.teamId !== teamId) return c.json({ error: "Forbidden" }, 403);

    const body = await c.req.json();
    const data: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.artworkType === "string") {
      if (!body.artworkType.trim()) return c.json({ error: "Choose an artwork type" }, 400);
      data.artworkType = body.artworkType.trim();
    }
    if (typeof body.skuId === "string" && body.skuId.trim()) data.skuId = body.skuId.trim();
    Object.assign(data, readLinks(body, true));
    await updateArtwork(existing.id, data);

    if (body.sections !== undefined) {
      const sections = readSections(body.sections);
      if (!sections.length) return c.json({ error: "Add at least one section" }, 400);
      await deleteSectionsFor(existing.id);
      await createSections(sections.map((s, i) => ({
        id: crypto.randomUUID(), artworkId: existing.id, name: s.name, data: s.data, sortOrder: i,
      })));
    }
    return c.json(await getArtwork(existing.id));
  })

  .delete("/:id", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "artwork");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const existing = await getArtwork(c.req.param("id"));
    if (!existing) return c.json({ error: "Not found" }, 404);
    if (existing.teamId !== teamId) return c.json({ error: "Forbidden" }, 403);
    await deleteArtwork(existing.id);  // sections cascade
    return c.json({ ok: true });
  })

  /** Append a single section to an existing artwork. */
  .post("/:id/sections", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "artwork");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const artwork = await getArtwork(c.req.param("id"));
    if (!artwork) return c.json({ error: "Not found" }, 404);
    if (artwork.teamId !== teamId) return c.json({ error: "Forbidden" }, 403);

    const body = await c.req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return c.json({ error: "Section name is required" }, 400);
    const [created] = await createSections([{
      id: crypto.randomUUID(), artworkId: artwork.id, name,
      data: typeof body.data === "string" ? body.data : "",
      sortOrder: await nextSortOrder(artwork.id),
    }]);
    return c.json(created, 201);
  });
