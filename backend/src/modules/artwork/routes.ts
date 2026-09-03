import { Hono } from "hono";
import { resolveTeamId } from "../../lib/resolve-team.ts";
import type { JWTPayload } from "../auth/jwt.ts";
import {
  getAllArtwork, getArtwork, createArtwork, updateArtwork, deleteArtwork,
  createSections, updateSection, deleteSection, deleteSectionsFor,
  nextSortOrder, getSectionTeam,
  upsertLink, deleteLink,
} from "./queries.ts";

type SectionInput = { name: string; data: string };

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

const LINK_KINDS = ["firstDraft", "manufacturerApproval", "finalPrinting", "nda", "other"] as const;
type LinkKind = (typeof LINK_KINDS)[number];

const isLinkKind = (v: string): v is LinkKind => (LINK_KINDS as readonly string[]).includes(v);

/** Prefixes a bare host so the Open button always resolves. */
const normaliseUrl = (raw: string) =>
  /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

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
      await createArtwork({ id, skuId, artworkType, teamId });
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

  // ── Links (saved one at a time, each stamped with who and when) ───────────
  .put("/:id/links/:kind", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "artwork");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const artwork = await getArtwork(c.req.param("id"));
    if (!artwork) return c.json({ error: "Not found" }, 404);
    if (artwork.teamId !== teamId) return c.json({ error: "Forbidden" }, 403);

    const kind = c.req.param("kind");
    if (!isLinkKind(kind)) return c.json({ error: "Unknown link type" }, 400);

    const body = await c.req.json();
    const raw = typeof body.url === "string" ? body.url.trim() : "";
    if (!raw) return c.json({ error: "Enter a link" }, 400);

    const [saved] = await upsertLink({
      id: crypto.randomUUID(),
      artworkId: artwork.id,
      kind,
      url: normaliseUrl(raw),
      updatedById: user.sub,
      updatedByName: user.name ?? null,
    });
    return c.json(saved);
  })
  .delete("/:id/links/:kind", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "artwork");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const artwork = await getArtwork(c.req.param("id"));
    if (!artwork) return c.json({ error: "Not found" }, 404);
    if (artwork.teamId !== teamId) return c.json({ error: "Forbidden" }, 403);

    const kind = c.req.param("kind");
    if (!isLinkKind(kind)) return c.json({ error: "Unknown link type" }, 400);
    await deleteLink(artwork.id, kind);
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
