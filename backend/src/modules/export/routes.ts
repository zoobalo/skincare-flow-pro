import { Hono } from "hono";
import JSZip from "jszip";
import { db } from "../../db/client.ts";
import { resolveTeamId } from "../../lib/resolve-team.ts";
import type { JWTPayload } from "../auth/jwt.ts";
import { toCsv, collectUrls } from "./csv.ts";
import { skus, skuDispatches, skuInventoryLocations } from "../../db/schema/skus.ts";
import { skuComments } from "../../db/schema/sku-comments.ts";
import { vendors } from "../../db/schema/vendors.ts";
import { manufacturers } from "../../db/schema/manufacturers.ts";
import { directory } from "../../db/schema/directory.ts";
import { impLinks } from "../../db/schema/imp-links.ts";
import { npd } from "../../db/schema/npd.ts";
import { followUpContacts, followUpTasks } from "../../db/schema/follow-ups.ts";
import { skuSalesWeekly } from "../../db/schema/sales.ts";
import { eq, inArray } from "drizzle-orm";

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

/**
 * One-click archive of the operational data, for keeping a copy outside the
 * platform. Produces a zip of CSVs plus, optionally, every image they
 * reference — so the export still means something if Storage is ever lost.
 */
export const exportRoutes = new Hono()
  .get("/", async (c) => {
    const user = c.get("user" as never) as JWTPayload;
    const teamId = await resolveTeamId(c, user, "export");
    if (!teamId) return c.json({ error: "Forbidden" }, 403);

    const withImages = c.req.query("images") !== "0";
    const zip = new JSZip();
    const urls = new Set<string>();
    const manifest: string[] = [];

    const add = (name: string, rows: Record<string, unknown>[], columns: string[]) => {
      zip.file(`${name}.csv`, toCsv(rows, columns));
      rows.forEach((r) => collectUrls(r, urls));
      manifest.push(`${name}.csv — ${rows.length} row${rows.length === 1 ? "" : "s"}`);
    };

    // ── SKU management ──────────────────────────────────────────────────────
    const skuRows = await db.select().from(skus).where(eq(skus.teamId, teamId));
    add("sku-management", skuRows, [
      "code", "name", "category", "type", "description", "image", "manufacturerId",
      "currentInventory", "minThreshold", "productionTimelineDays", "mrp", "usp",
      "importantLinks", "createdAt", "updatedAt",
    ]);
    const skuIds = skuRows.map((s) => s.id);
    const skuName = new Map(skuRows.map((s) => [s.id, s.name]));

    // ── SKU activity: comments and dispatches ───────────────────────────────
    const comments = skuIds.length
      ? await db.select().from(skuComments).where(inArray(skuComments.skuId, skuIds)) : [];
    add("sku-activity-comments",
      comments.map((r) => ({ ...r, skuName: skuName.get(r.skuId) ?? "" })),
      ["skuName", "text", "authorName", "createdAt"]);

    const dispatches = skuIds.length
      ? await db.select().from(skuDispatches).where(inArray(skuDispatches.skuId, skuIds)) : [];
    add("sku-activity-dispatches",
      dispatches.map((r) => ({ ...r, skuName: skuName.get(r.skuId) ?? "" })),
      ["skuName", "goodsType", "goodsName", "quantity", "dispatchDate", "from", "to",
       "transporterName", "vehicleNumber", "lrNumber", "freight", "status",
       "batchNumber", "invoiceNumber", "invoiceLink", "coaLink", "notes"]);

    // ── Vendors / manufacturers / directory ─────────────────────────────────
    add("vendors", await db.select().from(vendors).where(eq(vendors.teamId, teamId)), [
      "name", "contactPerson", "mobile", "email", "gst", "pan", "address", "city",
      "materials", "leadTimeDays", "paymentTerms", "rating", "reliability",
      "delayPercent", "totalOrders", "runningOrders", "totalSpend", "contacts",
      "docsLink", "createdAt",
    ]);
    add("manufacturers", await db.select().from(manufacturers).where(eq(manufacturers.teamId, teamId)), [
      "name", "location", "city", "email", "gst", "pan", "contactPerson", "mobile",
      "capacityPerMonth", "activeBatches", "qcPassRate", "leadTimeDays",
      "paymentTerms", "rating", "reliability", "delayPercent", "contacts",
      "docsLink", "createdAt",
    ]);
    add("directory", await db.select().from(directory).where(eq(directory.teamId, teamId)), [
      "name", "category", "address", "state", "country", "contact1Name", "contact1Phone",
      "contact2Name", "contact2Phone", "email1", "email2", "comment", "createdAt",
    ]);

    // ── IMP links ───────────────────────────────────────────────────────────
    add("imp-links", await db.select().from(impLinks).where(eq(impLinks.teamId, teamId)),
      ["name", "link", "comment", "createdAt"]);

    // ── New product development ─────────────────────────────────────────────
    add("new-product-development", await db.select().from(npd).where(eq(npd.teamId, teamId)),
      ["name", "launchMonth", "rmStatus", "pmStatus", "images", "comments", "createdAt", "updatedAt"]);

    // ── Follow ups (personal to the signed-in user) ─────────────────────────
    const contacts = await db.select().from(followUpContacts).where(eq(followUpContacts.ownerUserId, user.sub));
    const tasks = contacts.length
      ? await db.select().from(followUpTasks).where(inArray(followUpTasks.contactId, contacts.map((x) => x.id)))
      : [];
    const contactName = new Map(contacts.map((x) => [x.id, x.name]));
    add("follow-ups",
      tasks.map((t) => ({
        contact: contactName.get(t.contactId) ?? "",
        task: t.description,
        status: t.done ? "Done" : "Open",
        raisedOn: t.createdAt,
        completedOn: t.doneAt,
      })),
      ["contact", "task", "status", "raisedOn", "completedOn"]);

    // ── Inventory forecast: weekly sales and stock by location ──────────────
    add("inventory-forecast-weekly-sales",
      (await db.select().from(skuSalesWeekly).where(eq(skuSalesWeekly.teamId, teamId)))
        .map((r) => ({ ...r, skuName: skuName.get(r.skuId) ?? "" })),
      ["skuName", "weekEnding", "platform", "units", "importedByName", "importedAt"]);

    add("inventory-forecast-stock",
      (await db.select().from(skuInventoryLocations).where(eq(skuInventoryLocations.teamId, teamId)))
        .map((r) => ({ ...r, skuName: skuName.get(r.skuId) ?? "" })),
      ["skuName", "name", "quantity", "updatedAt"]);

    // ── Images ──────────────────────────────────────────────────────────────
    let saved = 0, failed = 0;
    if (withImages) {
      const list = [...urls].filter((u) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(u));
      for (const url of list) {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
          if (!res.ok) { failed++; continue; }
          const name = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "");
          if (!name) { failed++; continue; }
          zip.file(`images/${name}`, new Uint8Array(await res.arrayBuffer()));
          saved++;
        } catch { failed++; }
      }
    }

    zip.file("README.txt", [
      `Zoobalo data export`,
      `Taken: ${new Date().toISOString()}`,
      `By: ${user.name ?? user.email ?? user.sub}`,
      ``,
      `Files:`,
      ...manifest.map((m) => `  ${m}`),
      withImages
        ? `  images/ — ${saved} file${saved === 1 ? "" : "s"}${failed ? ` (${failed} could not be fetched)` : ""}`
        : `  images/ — skipped (requested without images)`,
      ``,
      `CSVs are UTF-8 with a byte-order mark, so Excel opens them correctly.`,
      `Follow ups are personal to each user; this file holds ${user.email ?? "this account"}'s only.`,
    ].join("\n"));

    const buf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    // Copy into a plain ArrayBuffer so the type matches BodyInit exactly.
    const body = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    return new Response(body, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="zoobalo-export-${stamp()}.zip"`,
        "Content-Length": String(body.byteLength),
      },
    });
  });
