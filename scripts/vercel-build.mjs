/**
 * Transforms vite build output (Cloudflare Workers format) into
 * Vercel Build Output API format so every deploy produces a working
 * Edge Function without relying on Vercel's auto-detection.
 *
 * dist/client/  → .vercel/output/static/
 * dist/server/  → .vercel/output/functions/__server.func/
 */
import { cpSync, mkdirSync, writeFileSync, rmSync, existsSync } from "fs";

if (existsSync(".vercel/output")) {
  rmSync(".vercel/output", { recursive: true });
}

mkdirSync(".vercel/output/static", { recursive: true });
mkdirSync(".vercel/output/functions/__server.func", { recursive: true });

cpSync("dist/client", ".vercel/output/static", { recursive: true });
cpSync("dist/server", ".vercel/output/functions/__server.func", { recursive: true });

writeFileSync(
  ".vercel/output/functions/__server.func/.vc-config.json",
  JSON.stringify({ runtime: "edge", entrypoint: "index.js" }, null, 2)
);

writeFileSync(
  ".vercel/output/config.json",
  JSON.stringify({
    version: 3,
    routes: [
      {
        src: "^/assets/(.*)$",
        headers: { "cache-control": "public, immutable, max-age=31536000" },
        continue: true,
      },
      { handle: "filesystem" },
      { src: "^/(.*)$", dest: "/__server" },
    ],
  }, null, 2)
);

console.log("✓ Vercel output structure created");
