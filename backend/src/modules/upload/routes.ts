import { Hono } from "hono";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const MAX_BYTES = 1 * 1024 * 1024; // 1 MB
const ALLOWED   = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png":  "png",
  "image/webp": "webp",
  "image/gif":  "gif",
};

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
        return c.json({ error: `File too large. Maximum size is 1 MB (received ${(file.size / 1024 / 1024).toFixed(2)} MB).` }, 400);
      }

      const ext      = EXT_MAP[file.type] ?? "jpg";
      const filename = `${crypto.randomUUID()}.${ext}`;
      const dest     = join(process.cwd(), "public", "uploads", filename);

      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(dest, buffer);

      return c.json({ url: `/uploads/${filename}` });
    } catch (err: any) {
      console.error("POST /upload error:", err);
      return c.json({ error: err?.message ?? "Upload failed." }, 500);
    }
  });
