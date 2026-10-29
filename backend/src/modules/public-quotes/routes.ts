import { Hono } from "hono";
import { getByToken, addQuote } from "../npd/quote-queries.ts";

/**
 * Vendor-facing routes. No authentication — the token in the URL is the only
 * credential, so each handler is deliberately narrow:
 *
 *  - reads expose only the brief, never other vendors' quotes or any NPD field
 *    beyond its name;
 *  - writes are refused once the request is closed;
 *  - uploads are accepted only against a valid open token, and only images
 *    within the same limits the authenticated route enforces.
 */
const MAX_BYTES = 1 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
};
const MAX_IMAGES = 6;

function storage() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Storage is not configured.");
  return { url: url.replace(/\/+$/, ""), key };
}

const str = (v: unknown, max = 2000) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

export const publicQuoteRoutes = new Hono()

  /** What the vendor sees: the product name, which material, and the brief. */
  .get("/:token", async (c) => {
    const req = await getByToken(c.req.param("token"));
    if (!req) return c.json({ error: "This link is not valid." }, 404);
    return c.json({
      npdName: req.npdName,
      kind: req.kind,
      brief: req.brief,
      status: req.status,
    });
  })

  /** Vendor submits a quotation. */
  .post("/:token", async (c) => {
    const req = await getByToken(c.req.param("token"));
    if (!req) return c.json({ error: "This link is not valid." }, 404);
    if (req.status !== "open") {
      return c.json({ error: "This request is closed and is no longer accepting quotations." }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const partyName = str(body.partyName, 200);
    if (!partyName) return c.json({ error: "Party name is required." }, 400);

    const costRaw = typeof body.cost === "string" || typeof body.cost === "number"
      ? String(body.cost).replace(/[^0-9.]/g, "") : "";
    const cost = costRaw === "" ? null : costRaw;

    const images = Array.isArray(body.images)
      ? body.images.filter((x: unknown): x is string => typeof x === "string").slice(0, MAX_IMAGES)
      : [];

    const [saved] = await addQuote({
      id: crypto.randomUUID(),
      requestId: req.id,
      partyName,
      leadTime: str(body.leadTime, 120),
      cost,
      description: str(body.description, 4000),
      images: req.kind === "PM" ? images : [],
    });

    // Deliberately minimal: the vendor gets confirmation, not a view of the data.
    return c.json({ ok: true, submittedAt: saved.submittedAt }, 201);
  })

  /** Image upload, only against a valid open token. */
  .post("/:token/upload", async (c) => {
    const req = await getByToken(c.req.param("token"));
    if (!req) return c.json({ error: "This link is not valid." }, 404);
    if (req.status !== "open") return c.json({ error: "This request is closed." }, 403);
    if (req.kind !== "PM") return c.json({ error: "Images are not accepted for this request." }, 400);

    try {
      const body = await c.req.parseBody();
      const file = body["file"];
      if (!file || typeof file === "string") return c.json({ error: "No file provided." }, 400);
      if (!ALLOWED.has(file.type)) return c.json({ error: "Only JPEG, PNG, WebP or GIF images are allowed." }, 400);
      if (file.size > MAX_BYTES) {
        return c.json({ error: `Image too large. Maximum size is 1 MB (received ${(file.size / 1024 / 1024).toFixed(2)} MB).` }, 400);
      }

      const { url, key } = storage();
      const filename = `quotes/${req.id}/${crypto.randomUUID()}.${EXT[file.type] ?? "jpg"}`;
      const res = await fetch(`${url}/storage/v1/object/uploads/${filename}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": file.type },
        body: new Uint8Array(await file.arrayBuffer()),
      });
      if (!res.ok) {
        console.error("public quote upload failed:", res.status, (await res.text()).slice(0, 200));
        return c.json({ error: "Upload failed. Please try again." }, 502);
      }
      return c.json({ url: `${url}/storage/v1/object/public/uploads/${filename}` });
    } catch (err: any) {
      console.error("POST /public/quotes/:token/upload error:", err);
      return c.json({ error: "Upload failed." }, 500);
    }
  });
