import { Hono } from "hono";

const MAX_BYTES = 1 * 1024 * 1024; // 1 MB
const ALLOWED   = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png":  "png",
  "image/webp": "webp",
  "image/gif":  "gif",
};

const BUCKET = "uploads";

/**
 * Uploads live in Supabase Storage rather than on the server's disk.
 *
 * The previous implementation wrote into ./public/uploads, which only worked
 * because the API owned a persistent filesystem. Any managed host replaces that
 * disk on each deploy, so the files had to move somewhere durable.
 */
function storageConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set for uploads to work.",
    );
  }
  return { url: url.replace(/\/+$/, ""), key };
}

/** Public URL for a stored object — the bucket is public, as /uploads/* was. */
export function publicUrl(filename: string) {
  const { url } = storageConfig();
  return `${url}/storage/v1/object/public/${BUCKET}/${filename}`;
}

export const uploadRoutes = new Hono()
  .post("/", async (c) => {
    try {
      const body = await c.req.parseBody();
      const file = body["file"];

      if (!file || typeof file === "string") {
        return c.json({ error: "No file provided." }, 400);
      }
      if (!ALLOWED.has(file.type)) {
        return c.json({ error: "Only JPEG, PNG, WebP or GIF images are allowed." }, 400);
      }
      if (file.size > MAX_BYTES) {
        return c.json({
          error: `File too large. Maximum size is 1 MB (received ${(file.size / 1024 / 1024).toFixed(2)} MB).`,
        }, 400);
      }

      const { url, key } = storageConfig();
      const ext      = EXT_MAP[file.type] ?? "jpg";
      const filename = `${crypto.randomUUID()}.${ext}`;

      const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${filename}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": file.type,
          "cache-control": "public, max-age=31536000, immutable",
        },
        body: new Uint8Array(await file.arrayBuffer()),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error("storage upload failed:", res.status, detail.slice(0, 200));
        return c.json({ error: "Upload failed. Please try again." }, 502);
      }

      return c.json({ url: publicUrl(filename) });
    } catch (err: any) {
      console.error("POST /upload error:", err);
      return c.json({ error: err?.message ?? "Upload failed." }, 500);
    }
  });
