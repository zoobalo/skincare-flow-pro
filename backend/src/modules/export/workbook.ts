import ExcelJS from "exceljs";

const HEADER_FILL = "FF1F3864";
const THUMB = 64;          // px — matches the row height we set
const MAX_THUMBS = 3;      // images embedded per row, side by side

export type Column = { key: string; header: string; width?: number };

/** Fetched image bytes, keyed by URL. */
export type ImageCache = Map<string, { buffer: Uint8Array; ext: "jpeg" | "png" | "gif" }>;

const extFor = (url: string): "jpeg" | "png" | "gif" => {
  const u = url.toLowerCase();
  if (u.includes(".png")) return "png";
  if (u.includes(".gif")) return "gif";
  return "jpeg";
};

/** Downloads each distinct image once; failures are skipped, never fatal. */
export async function fetchImages(urls: Iterable<string>): Promise<ImageCache> {
  const cache: ImageCache = new Map();
  const list = [...new Set(urls)].filter((u) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(u));
  // A little concurrency: 73 images one at a time took ~100s.
  const queue = [...list];
  const workers = Array.from({ length: 6 }, async () => {
    for (;;) {
      const url = queue.shift();
      if (!url) return;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
        if (!res.ok) continue;
        cache.set(url, { buffer: new Uint8Array(await res.arrayBuffer()), ext: extFor(url) });
      } catch { /* a missing image must not fail the export */ }
    }
  });
  await Promise.all(workers);
  return cache;
}

/**
 * One sheet per section. Where a row carries image URLs, the pictures are
 * embedded beside it — a spreadsheet can show them; a CSV cannot.
 */
export function addSheet(
  wb: ExcelJS.Workbook,
  name: string,
  rows: Record<string, unknown>[],
  columns: Column[],
  opts: { imagesOf?: (row: Record<string, unknown>) => string[]; cache?: ImageCache } = {},
) {
  const ws = wb.addWorksheet(name.slice(0, 31));
  const hasImages = Boolean(opts.imagesOf && opts.cache);

  const cols: Partial<ExcelJS.Column>[] = columns.map((c) => ({
    header: c.header, key: c.key, width: c.width ?? 22,
  }));
  if (hasImages) {
    for (let i = 0; i < MAX_THUMBS; i++) {
      cols.push({ header: i === 0 ? "Picture" : "", key: `__img${i}`, width: 11 });
    }
  }
  ws.columns = cols;

  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10, name: "Arial" };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  head.alignment = { vertical: "middle", wrapText: true };
  head.height = 24;
  ws.views = [{ state: "frozen", ySplit: 1 }];

  rows.forEach((r, i) => {
    const flat: Record<string, unknown> = {};
    for (const c of columns) {
      const v = r[c.key];
      flat[c.key] = Array.isArray(v) ? v.join(" | ")
        : v && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v)
        : v ?? "";
    }
    const row = ws.addRow(flat);
    row.font = { size: 10, name: "Arial" };
    row.alignment = { vertical: "top", wrapText: true };

    if (!hasImages) return;
    const urls = opts.imagesOf!(r).filter((u) => opts.cache!.has(u)).slice(0, MAX_THUMBS);
    if (!urls.length) return;

    row.height = THUMB * 0.78;           // points ≈ px * 0.75, plus a little margin
    urls.forEach((url, n) => {
      const img = opts.cache!.get(url)!;
      const id = wb.addImage({ buffer: Buffer.from(img.buffer) as any, extension: img.ext });
      ws.addImage(id, {
        tl: { col: columns.length + n + 0.1, row: i + 1 + 0.1 } as ExcelJS.Anchor,
        ext: { width: THUMB, height: THUMB },
      });
    });
  });

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(rows.length + 1, 1), column: columns.length },
  };
  return ws;
}
