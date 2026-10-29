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
