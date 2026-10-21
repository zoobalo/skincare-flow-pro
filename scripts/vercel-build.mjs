/**
 * Transforms vite build output (Cloudflare Workers format) into
 * Vercel Build Output API format so every deploy produces a working
 * Edge Function without relying on Vercel's auto-detection.
 *
 * dist/client/  → .vercel/output/static/
 * dist/server/  → .vercel/output/functions/__server.func/
 */
import { cpSync, mkdirSync, writeFileSync, rmSync, existsSync, renameSync } from "fs";

if (existsSync(".vercel/output")) {
  rmSync(".vercel/output", { recursive: true });
}

mkdirSync(".vercel/output/static", { recursive: true });
mkdirSync(".vercel/output/functions/__server.func", { recursive: true });

cpSync("dist/client", ".vercel/output/static", { recursive: true });
cpSync("dist/server", ".vercel/output/functions/__server.func", { recursive: true });

// The vite build emits a Cloudflare Workers handler — `export default { fetch }`
// — but Vercel's Nodejs launcher calls a (req, res) function. Without this
// adapter the function loads and then fails on every invocation with
// FUNCTION_INVOCATION_FAILED. Rename the worker and put a bridge in its place.
renameSync(
  ".vercel/output/functions/__server.func/index.js",
  ".vercel/output/functions/__server.func/worker-entry.js",
);

writeFileSync(
  ".vercel/output/functions/__server.func/index.js",
  `import worker from "./worker-entry.js";

/** Node request -> web Request -> worker.fetch -> Node response. */
export default async function handler(req, res) {
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", \`\${proto}://\${host}\`);

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
    else if (v != null) headers.set(k, String(v));
  }

  let body;
  if (req.method && !["GET", "HEAD"].includes(req.method)) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (chunks.length) body = Buffer.concat(chunks);
  }

  const response = await worker.fetch(
    new Request(url, { method: req.method, headers, body, duplex: "half" }),
  );

  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") res.appendHeader?.("set-cookie", value);
    else res.setHeader(key, value);
  });

  if (!response.body) return res.end();
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(Buffer.from(value));
  }
  res.end();
}
`,
);

writeFileSync(
  ".vercel/output/functions/__server.func/.vc-config.json",
  JSON.stringify({
    runtime: "nodejs22.x",
    handler: "index.js",
    launcherType: "Nodejs",
    supportsResponseStreaming: true,
  }, null, 2)
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
