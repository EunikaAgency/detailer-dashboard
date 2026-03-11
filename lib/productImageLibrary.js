import path from "path";
import { promises as fs } from "fs";

const manifestPath = path.join(process.cwd(), "public", "uploads", "product-library", "manifest.json");
const CACHE_TTL_MS = 5000;

let cachedManifest = null;
let cachedAtMs = 0;

const cleanUrl = (value = "") => String(value || "").split("#")[0].split("?")[0].trim();

const withOriginalSuffix = (originalUrl = "", mappedUrl = "") => {
  if (!mappedUrl) return originalUrl;
  const clean = cleanUrl(originalUrl);
  if (!clean || clean === originalUrl) return mappedUrl;
  return `${mappedUrl}${originalUrl.slice(clean.length)}`;
};

const rewriteUrl = (value, mappings) => {
  const clean = cleanUrl(value);
  if (!clean) return value;
  const mappedUrl = mappings[clean];
  return mappedUrl ? withOriginalSuffix(value, mappedUrl) : value;
};

const rewriteHotspots = (hotspots, mappings) => {
  if (!Array.isArray(hotspots) || !hotspots.length) return hotspots;
  return hotspots.map((hotspot) => ({
    ...hotspot,
    targetPageId: rewriteUrl(hotspot?.targetPageId, mappings),
  }));
};

const rewriteFlatMediaItems = (items, mappings) => {
  if (!Array.isArray(items) || !items.length) return items;
  return items.map((item) => ({
    ...item,
    url: rewriteUrl(item?.url, mappings),
    thumbnailUrl: rewriteUrl(item?.thumbnailUrl, mappings),
    hotspots: rewriteHotspots(item?.hotspots, mappings),
  }));
};

const rewriteGroupedMedia = (media, mappings) => {
  if (!Array.isArray(media) || !media.length) return media;
  if (media[0] && Array.isArray(media[0].items)) {
    return media.map((group) => ({
      ...group,
      items: rewriteFlatMediaItems(group?.items || [], mappings),
    }));
  }
  return rewriteFlatMediaItems(media, mappings);
};

export const loadProductImageLibraryManifest = async () => {
  const now = Date.now();
  if (cachedManifest && now - cachedAtMs < CACHE_TTL_MS) {
    return cachedManifest;
  }

  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    cachedManifest = JSON.parse(raw);
    cachedAtMs = now;
    return cachedManifest;
  } catch {
    cachedManifest = null;
    cachedAtMs = now;
    return null;
  }
};

export const applyProductImageLibrary = async (products = []) => {
  const manifest = await loadProductImageLibraryManifest();
  const mappings = manifest?.mappings;
  if (!mappings || typeof mappings !== "object") return products;

  return products.map((product) => ({
    ...product,
    thumbnailUrl: rewriteUrl(product?.thumbnailUrl, mappings),
    media: rewriteGroupedMedia(product?.media || [], mappings),
  }));
};

