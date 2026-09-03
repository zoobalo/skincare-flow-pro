import { Hono } from "hono";
import { resolveTeamId } from "../../lib/resolve-team.ts";
import type { JWTPayload } from "../auth/jwt.ts";
import {
  getAllSkus, getSku, createSku, updateSku, deleteSku,
  createSections, updateSection, deleteSection, getSectionsBySku,
  nextSortOrder, getSectionTeam,
  getLibrary, getLibraryEntries, createLibraryEntry, updateLibraryEntry, deleteLibraryEntry,
} from "./queries.ts";

/** Trims a section payload into storable shape. */
function sectionInput(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const details = typeof body.details === "string" ? body.details : "";
  const packagingTypes = Array.isArray(body.packagingTypes)
    ? body.packagingTypes.filter((t): t is string => typeof t === "string")
    : [];
  return { name, details, packagingTypes };
}

export const artworkRoutes = new Hono()

  // ── Library ────────────────────────────────────────────────────────────────
  // Registered before /:id so "library" is never read as a SKU id.
  .get("/library", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "artwork");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    return c.json(await getLibrary(teamId));
  })
  .post("/library", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "artwork");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const input = sectionInput(await c.req.json());
    if (!input.name) return c.json({ error: "Section name is required" }, 400);
    const [created] = await createLibraryEntry({ id: crypto.randomUUID(), teamId, ...input });
    return c.json(created, 201);
  })
  .patch("/library/:id", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "artwork");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const input = sectionInput(await c.req.json());
    if (!input.name) return c.json({ error: "Section name is required" }, 400);
    const [updated] = await updateLibraryEntry(c.req.param("id"), teamId, { ...input, updatedAt: new Date() });
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })
  .delete("/library/:id", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "artwork");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const [deleted] = await deleteLibraryEntry(c.req.param("id"), teamId);
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  })

  // ── Sections ───────────────────────────────────────────────────────────────
  // Authorised through the parent SKU's team, never the caller's claim.
  .patch("/sections/:sectionId", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "artwork");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const owner = await getSectionTeam(c.req.param("sectionId"));
    if (!owner) return c.json({ error: "Not found" }, 404);
    if (owner.teamId !== teamId) return c.json({ error: "Forbidden" }, 403);

    const body = await c.req.json();
    const input = sectionInput(body);
    if (!input.name) return c.json({ error: "Section name is required" }, 400);
    const [updated] = await updateSection(c.req.param("sectionId"), {
      ...input,
      ...(typeof body.sortOrder === "number" ? { sortOrder: body.sortOrder } : {}),
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

  // ── SKUs ───────────────────────────────────────────────────────────────────
  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "artwork");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    return c.json(await getAllSkus(teamId));
  })
  .post("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "artwork");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);

    const body = await c.req.json();
    const skuName = typeof body.skuName === "string" ? body.skuName.trim() : "";
    if (!skuName) return c.json({ error: "SKU name is required" }, 400);

    const id = crypto.randomUUID();
    await createSku({
      id, skuName, teamId,
      notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    });

    // Optional seeding, in one shot, so a new SKU can start pre-filled.
    const rows: Parameters<typeof createSections>[0] = [];
    let order = 0;

    if (typeof body.copyFromSkuId === "string" && body.copyFromSkuId) {
      const source = await getSku(body.copyFromSkuId);
      if (source && source.teamId === teamId) {
        for (const s of source.sections) {
          rows.push({
            id: crypto.randomUUID(), skuId: id,
            name: s.name, details: s.details, packagingTypes: s.packagingTypes,
            sortOrder: order++,
          });
        }
      }
    }

    if (Array.isArray(body.libraryEntryIds) && body.libraryEntryIds.length) {
      const ids = body.libraryEntryIds.filter((x: unknown): x is string => typeof x === "string");
      for (const e of await getLibraryEntries(teamId, ids)) {
        rows.push({
          id: crypto.randomUUID(), skuId: id,
          name: e.name, details: e.details, packagingTypes: e.packagingTypes,
          sortOrder: order++,
        });
      }
    }

    if (rows.length) await createSections(rows);
    return c.json(await getSku(id), 201);
  })
  .patch("/:id", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "artwork");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const existing = await getSku(c.req.param("id"));
    if (!existing) return c.json({ error: "Not found" }, 404);
    if (existing.teamId !== teamId) return c.json({ error: "Forbidden" }, 403);

    const body = await c.req.json();
    const data: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.skuName === "string") {
      if (!body.skuName.trim()) return c.json({ error: "SKU name is required" }, 400);
      data.skuName = body.skuName.trim();
    }
    if (body.notes !== undefined) {
      data.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
    }
    const [updated] = await updateSku(c.req.param("id"), data);
    return c.json(updated);
  })
  .delete("/:id", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "artwork");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const existing = await getSku(c.req.param("id"));
    if (!existing) return c.json({ error: "Not found" }, 404);
    if (existing.teamId !== teamId) return c.json({ error: "Forbidden" }, 403);
    await deleteSku(c.req.param("id"));  // sections cascade
    return c.json({ ok: true });
  })

  // ── Adding sections to a SKU ───────────────────────────────────────────────
  .post("/:id/sections", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "artwork");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const sku = await getSku(c.req.param("id"));
    if (!sku) return c.json({ error: "Not found" }, 404);
    if (sku.teamId !== teamId) return c.json({ error: "Forbidden" }, 403);

    const input = sectionInput(await c.req.json());
    if (!input.name) return c.json({ error: "Section name is required" }, 400);
    const [created] = await createSections([{
      id: crypto.randomUUID(), skuId: sku.id, ...input,
      sortOrder: await nextSortOrder(sku.id),
    }]);
    return c.json(created, 201);
  })
  /** Bulk-insert library entries as sections on an existing SKU. */
  .post("/:id/from-library", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "artwork");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const sku = await getSku(c.req.param("id"));
    if (!sku) return c.json({ error: "Not found" }, 404);
    if (sku.teamId !== teamId) return c.json({ error: "Forbidden" }, 403);

    const body = await c.req.json();
    const ids = Array.isArray(body.entryIds)
      ? body.entryIds.filter((x: unknown): x is string => typeof x === "string")
      : [];
    if (!ids.length) return c.json({ error: "No library entries selected" }, 400);

    const entries = await getLibraryEntries(teamId, ids);
    if (!entries.length) return c.json({ error: "No matching library entries" }, 404);

    let order = await nextSortOrder(sku.id);
    await createSections(entries.map((e) => ({
      id: crypto.randomUUID(), skuId: sku.id,
      name: e.name, details: e.details, packagingTypes: e.packagingTypes,
      sortOrder: order++,
    })));
    return c.json(await getSku(sku.id), 201);
  })
  /** Copy every section from another SKU, appended after what is already there. */
  .post("/:id/copy-from", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "artwork");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const target = await getSku(c.req.param("id"));
    if (!target) return c.json({ error: "Not found" }, 404);
    if (target.teamId !== teamId) return c.json({ error: "Forbidden" }, 403);

    const { sourceSkuId } = await c.req.json();
    if (typeof sourceSkuId !== "string" || !sourceSkuId) {
      return c.json({ error: "sourceSkuId is required" }, 400);
    }
    if (sourceSkuId === target.id) return c.json({ error: "Cannot copy a SKU onto itself" }, 400);

    const source = await getSku(sourceSkuId);
    if (!source || source.teamId !== teamId) return c.json({ error: "Source SKU not found" }, 404);

    const sections = await getSectionsBySku(source.id);
    if (!sections.length) return c.json({ error: "Source SKU has no sections to copy" }, 400);

    let order = await nextSortOrder(target.id);
    await createSections(sections.map((s) => ({
      id: crypto.randomUUID(), skuId: target.id,
      name: s.name, details: s.details, packagingTypes: s.packagingTypes,
      sortOrder: order++,
    })));
    return c.json(await getSku(target.id), 201);
  })
  /** Promote an existing section into the reusable library. */
  .post("/sections/:sectionId/to-library", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "artwork");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);
    const owner = await getSectionTeam(c.req.param("sectionId"));
    if (!owner) return c.json({ error: "Not found" }, 404);
    if (owner.teamId !== teamId) return c.json({ error: "Forbidden" }, 403);

    const sections = await getSectionsBySku(owner.skuId);
    const section = sections.find((s) => s.id === c.req.param("sectionId"));
    if (!section) return c.json({ error: "Not found" }, 404);

    const [created] = await createLibraryEntry({
      id: crypto.randomUUID(), teamId,
      name: section.name, details: section.details, packagingTypes: section.packagingTypes,
    });
    return c.json(created, 201);
  });
