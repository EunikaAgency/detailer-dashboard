import type { Product } from "./products";

export const MEDIA_CACHE_NAME = "one-detailer-media-v1";
export const PRESENTATION_CACHE_NAME = "one-detailer-presentation-assets-v1";

const OFFLINE_PRESENTATIONS_KEY = "offlinePresentationDownloads";

export interface OfflinePresentationRecord {
  productId: string;
  productName: string;
  deckIds: string[];
  assetCount: number;
  updatedAt: string;
}

export interface OfflinePresentationSummary {
  downloadedProducts: number;
  downloadedDecks: number;
  cachedAssets: number;
  records: OfflinePresentationRecord[];
}

interface CachedAssetResult {
  cached: number;
  failed: number;
}

interface ProductAssetPlan {
  deckIds: string[];
  productName: string;
  mediaUrls: string[];
  presentationUrls: string[];
  htmlUrls: string[];
}

function isBrowser() {
  return typeof window !== "undefined";
}

function isHttpUrl(url: string) {
  return /^https?:\/\//i.test(String(url || "").trim());
}

function toAbsoluteUrl(url: string) {
  const trimmed = String(url || "").trim();
  if (!trimmed || !isBrowser()) return "";

  try {
    return new URL(trimmed, window.location.origin).toString();
  } catch {
    return "";
  }
}

function uniqueUrls(urls: string[]) {
  return Array.from(
    new Set(
      urls
        .map((url) => toAbsoluteUrl(url))
        .filter((url) => isHttpUrl(url))
    )
  );
}

function isUploadsUrl(url: string) {
  try {
    return new URL(url).pathname.includes("/uploads/");
  } catch {
    return false;
  }
}

function isLikelyImageUrl(url: string) {
  return /\.(avif|gif|ico|jpe?g|png|svg|webp)(\?|#|$)/i.test(url);
}

function classifyCacheName(url: string) {
  if (isUploadsUrl(url)) {
    return PRESENTATION_CACHE_NAME;
  }

  return isLikelyImageUrl(url) ? MEDIA_CACHE_NAME : PRESENTATION_CACHE_NAME;
}

function readOfflinePresentationMap(): Record<string, OfflinePresentationRecord> {
  if (!isBrowser()) {
    return {};
  }

  try {
    const stored = localStorage.getItem(OFFLINE_PRESENTATIONS_KEY);
    if (!stored) return {};

    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeOfflinePresentationMap(next: Record<string, OfflinePresentationRecord>) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(OFFLINE_PRESENTATIONS_KEY, JSON.stringify(next));
}

function saveOfflinePresentationRecord(record: OfflinePresentationRecord) {
  const current = readOfflinePresentationMap();
  current[record.productId] = record;
  writeOfflinePresentationMap(current);
}

function getSameOriginCredentials(url: string): RequestCredentials {
  if (!isBrowser()) {
    return "omit";
  }

  try {
    return new URL(url).origin === window.location.origin ? "include" : "omit";
  } catch {
    return "omit";
  }
}

export function collectProductImageUrls(products: Product[]) {
  const urls: string[] = [];

  for (const product of products) {
    if (product.thumbnail) {
      urls.push(product.thumbnail);
    }

    const groups = Array.isArray(product.media) ? product.media : [];
    for (const group of groups) {
      const items = Array.isArray(group.items) ? group.items : [];
      for (const item of items) {
        if (item.thumbnailUrl) {
          urls.push(item.thumbnailUrl);
        }

        if (item.type === "image" && item.url) {
          urls.push(item.url);
        }
      }
    }
  }

  return uniqueUrls(urls);
}

function buildProductAssetPlan(product: Product): ProductAssetPlan {
  const mediaUrls: string[] = [];
  const presentationUrls: string[] = [];
  const htmlUrls: string[] = [];
  const deckIds = new Set<string>();

  if (product.thumbnail) {
    mediaUrls.push(product.thumbnail);
  }

  const groups = Array.isArray(product.media) ? product.media : [];
  for (const group of groups) {
    if (group?.groupId) {
      deckIds.add(group.groupId);
    }

    const items = Array.isArray(group.items) ? group.items : [];
    for (const item of items) {
      if (item.thumbnailUrl) {
        const cacheName = classifyCacheName(item.thumbnailUrl);
        (cacheName === MEDIA_CACHE_NAME ? mediaUrls : presentationUrls).push(item.thumbnailUrl);
      }

      if (!item.url) {
        continue;
      }

      if (item.type === "html") {
        htmlUrls.push(item.url);
        continue;
      }

      const cacheName =
        item.type === "image" && !isUploadsUrl(item.url)
          ? MEDIA_CACHE_NAME
          : classifyCacheName(item.url);

      (cacheName === MEDIA_CACHE_NAME ? mediaUrls : presentationUrls).push(item.url);
    }
  }

  return {
    deckIds: Array.from(deckIds),
    productName: product.name || product._id || "Presentation",
    mediaUrls: uniqueUrls(mediaUrls),
    presentationUrls: uniqueUrls(presentationUrls),
    htmlUrls: uniqueUrls(htmlUrls),
  };
}

async function waitForServiceWorkerReady() {
  if (!isBrowser() || !("serviceWorker" in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.ready;
  } catch {
    // Ignore registration timing failures.
  }
}

function preloadImage(url: string) {
  return new Promise<boolean>((resolve) => {
    const image = new Image();

    const finish = (ok: boolean) => {
      image.onload = null;
      image.onerror = null;
      image.onabort = null;
      resolve(ok);
    };

    image.decoding = "async";
    image.loading = "eager";
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    image.onabort = () => finish(false);
    image.src = url;
  });
}

async function warmUrls(urls: string[]) {
  const queue = [...urls];
  let cached = 0;

  const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) continue;
      const ok = await preloadImage(next);
      if (ok) cached += 1;
    }
  });

  await Promise.all(workers);
  return cached;
}

async function fetchCacheableResponse(url: string) {
  const credentials = getSameOriginCredentials(url);

  try {
    const response = await fetch(url, {
      credentials,
      mode: credentials === "include" ? "same-origin" : "cors",
    });

    if (response.ok || response.type === "opaque") {
      return response;
    }
  } catch {
    // Fall through to no-cors attempt for cross-origin assets.
  }

  if (credentials === "omit") {
    const opaqueResponse = await fetch(url, {
      credentials: "omit",
      mode: "no-cors",
    });

    if (opaqueResponse.type === "opaque") {
      return opaqueResponse;
    }
  }

  throw new Error(`Failed to cache ${url}`);
}

async function cacheUrl(cacheName: string, url: string) {
  const cache = await caches.open(cacheName);
  const response = await fetchCacheableResponse(url);
  await cache.put(url, response.clone());
  return true;
}

async function cacheUrlBatch(cacheName: string, urls: string[]): Promise<CachedAssetResult> {
  const queue = [...urls];
  let cached = 0;
  let failed = 0;

  const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) continue;

      try {
        await cacheUrl(cacheName, next);
        cached += 1;
      } catch {
        failed += 1;
      }
    }
  });

  await Promise.all(workers);
  return { cached, failed };
}

function extractHtmlDependencyUrls(html: string, baseUrl: string) {
  if (!isBrowser() || typeof DOMParser === "undefined" || !html.trim()) {
    return [];
  }

  try {
    const document = new DOMParser().parseFromString(html, "text/html");
    const values: string[] = [];
    const elements = document.querySelectorAll("[src], [href]");

    elements.forEach((element) => {
      const raw =
        element.getAttribute("src") ||
        element.getAttribute("href") ||
        "";

      const trimmed = raw.trim();
      if (!trimmed || trimmed.startsWith("#") || /^(data:|javascript:|mailto:|tel:)/i.test(trimmed)) {
        return;
      }

      try {
        values.push(new URL(trimmed, baseUrl).toString());
      } catch {
        // Ignore invalid relative paths.
      }
    });

    return uniqueUrls(values);
  } catch {
    return [];
  }
}

async function cacheHtmlDocumentAndDependencies(url: string) {
  const cache = await caches.open(PRESENTATION_CACHE_NAME);
  const dependencies: string[] = [];

  try {
    const response = await fetch(url, {
      credentials: getSameOriginCredentials(url),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch HTML slide ${url}`);
    }

    const clone = response.clone();
    const html = await response.text();
    await cache.put(url, clone);
    dependencies.push(...extractHtmlDependencyUrls(html, url));
    return { cached: 1, failed: 0, dependencies };
  } catch {
    try {
      await cacheUrl(PRESENTATION_CACHE_NAME, url);
      return { cached: 1, failed: 0, dependencies };
    } catch {
      return { cached: 0, failed: 1, dependencies };
    }
  }
}

export async function warmProductMediaCache(products: Product[]) {
  if (!isBrowser() || !navigator.onLine) {
    return { attempted: 0, cached: 0 };
  }

  const urls = collectProductImageUrls(products);
  if (urls.length === 0) {
    return { attempted: 0, cached: 0 };
  }

  await waitForServiceWorkerReady();
  const cached = await warmUrls(urls);
  return { attempted: urls.length, cached };
}

export async function cacheProductForOffline(product: Product) {
  if (!isBrowser() || !("caches" in window)) {
    return { attempted: 0, cached: 0, failed: 0 };
  }

  await waitForServiceWorkerReady();

  const plan = buildProductAssetPlan(product);
  const htmlDependencies: string[] = [];
  let cached = 0;
  let failed = 0;

  for (const htmlUrl of plan.htmlUrls) {
    const result = await cacheHtmlDocumentAndDependencies(htmlUrl);
    cached += result.cached;
    failed += result.failed;
    htmlDependencies.push(...result.dependencies);
  }

  const dependencyBuckets = htmlDependencies.reduce<Record<string, string[]>>(
    (accumulator, url) => {
      const cacheName = classifyCacheName(url);
      accumulator[cacheName] = accumulator[cacheName] || [];
      accumulator[cacheName].push(url);
      return accumulator;
    },
    {}
  );

  const mediaResult = await cacheUrlBatch(MEDIA_CACHE_NAME, plan.mediaUrls);
  const presentationResult = await cacheUrlBatch(PRESENTATION_CACHE_NAME, plan.presentationUrls);
  const dependencyMediaResult = await cacheUrlBatch(
    MEDIA_CACHE_NAME,
    uniqueUrls(dependencyBuckets[MEDIA_CACHE_NAME] || [])
  );
  const dependencyPresentationResult = await cacheUrlBatch(
    PRESENTATION_CACHE_NAME,
    uniqueUrls(dependencyBuckets[PRESENTATION_CACHE_NAME] || [])
  );

  cached +=
    mediaResult.cached +
    presentationResult.cached +
    dependencyMediaResult.cached +
    dependencyPresentationResult.cached;

  failed +=
    mediaResult.failed +
    presentationResult.failed +
    dependencyMediaResult.failed +
    dependencyPresentationResult.failed;

  saveOfflinePresentationRecord({
    productId: product._id || product.id || product.name,
    productName: plan.productName,
    deckIds: plan.deckIds,
    assetCount: cached,
    updatedAt: new Date().toISOString(),
  });

  return {
    attempted:
      plan.mediaUrls.length +
      plan.presentationUrls.length +
      plan.htmlUrls.length +
      uniqueUrls(htmlDependencies).length,
    cached,
    failed,
  };
}

export async function cacheProductsForOffline(products: Product[]) {
  const results = await Promise.all(products.map((product) => cacheProductForOffline(product)));
  return results.reduce(
    (summary, result) => ({
      attempted: summary.attempted + result.attempted,
      cached: summary.cached + result.cached,
      failed: summary.failed + result.failed,
    }),
    { attempted: 0, cached: 0, failed: 0 }
  );
}

export function getOfflinePresentationRecord(productId: string) {
  const records = readOfflinePresentationMap();
  return records[productId] || null;
}

export function getOfflinePresentationSummary(): OfflinePresentationSummary {
  const records = Object.values(readOfflinePresentationMap()).sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  );

  return {
    downloadedProducts: records.length,
    downloadedDecks: records.reduce((total, record) => total + record.deckIds.length, 0),
    cachedAssets: records.reduce((total, record) => total + record.assetCount, 0),
    records,
  };
}

async function getCacheEntryCount(cacheName: string) {
  if (!isBrowser() || !("caches" in window)) {
    return 0;
  }

  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    return keys.length;
  } catch {
    return 0;
  }
}

export async function getMediaCacheEntryCount() {
  return getCacheEntryCount(MEDIA_CACHE_NAME);
}

export async function getPresentationCacheEntryCount() {
  return getCacheEntryCount(PRESENTATION_CACHE_NAME);
}

export async function clearMediaCache() {
  if (!isBrowser() || !("caches" in window)) {
    return false;
  }

  try {
    return await caches.delete(MEDIA_CACHE_NAME);
  } catch {
    return false;
  }
}

export async function clearPresentationCache() {
  if (!isBrowser() || !("caches" in window)) {
    return false;
  }

  try {
    const deleted = await caches.delete(PRESENTATION_CACHE_NAME);
    localStorage.removeItem(OFFLINE_PRESENTATIONS_KEY);
    return deleted;
  } catch {
    return false;
  }
}
