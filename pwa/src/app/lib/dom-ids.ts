export function sanitizeIdSegment(value: unknown, fallback = "item") {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

export function buildDomId(...parts: Array<unknown>) {
  return parts
    .map((part, index) => sanitizeIdSegment(part, `part-${index + 1}`))
    .join("-");
}
