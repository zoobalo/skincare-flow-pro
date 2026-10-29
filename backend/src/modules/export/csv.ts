/** Minimal RFC 4180 CSV writer — quotes everything, so commas and newlines in
 *  addresses or comments can't break a row. */
export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return '""';
    if (Array.isArray(v)) return `"${v.join(" | ").replace(/"/g, '""')}"`;
    if (v instanceof Date) return `"${v.toISOString()}"`;
    if (typeof v === "object") return `"${JSON.stringify(v).replace(/"/g, '""')}"`;
    return `"${String(v).replace(/"/g, '""')}"`;
  };
  const head = columns.map((c) => cell(c)).join(",");
  const body = rows.map((r) => columns.map((c) => cell(r[c])).join(",")).join("\n");
  // BOM so Excel opens UTF-8 (vendor names, addresses) correctly.
  return "﻿" + head + (body ? "\n" + body : "") + "\n";
}

/** Pulls every http(s) URL out of a value, however deeply nested. */
export function collectUrls(value: unknown, into: Set<string>) {
  if (typeof value === "string") {
    if (/^https?:\/\//.test(value)) into.add(value);
    return;
  }
  if (Array.isArray(value)) { value.forEach((v) => collectUrls(v, into)); return; }
  if (value && typeof value === "object") {
    Object.values(value).forEach((v) => collectUrls(v, into));
  }
}
