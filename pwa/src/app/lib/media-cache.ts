import type { Product } from "./products";

export const MEDIA_CACHE_NAME = "one-detailer-media-v1";
export const PRESENTATION_CACHE_NAME = "one-detailer-presentation-assets-v1";

const OFFLINE_PRESENTATIONS_KEY = "offlinePresentationDownloads";
const STORAGE_HEADROOM_MIN_BYTES = 50 * 1024 * 1024;

export type OfflineDeckDownloadState =
  | "not_downloaded"
  | "downloading"
  | "downloaded"
  | "incomplete"
  | "corrupted"
  | "needs_update";

export interface OfflineStorageEstimate {
  quota: number | null;
  usage: number | null;
  available: number | null;
  headroomRatio: number | null;
  persisted: boolean | null;
}

export interface OfflineDeckManifest {
  deckId: string;
  title: string;
  revision: string;
  requiredUrls: string[];
  optionalUrls: string[];
  requiredAssetCount: number;
  missingRequiredUrls: string[];
  status: OfflineDeckDownloadState;
  lastVerifiedAt: string | null;
}

export interface OfflinePresentationRecord {
  productId: string;
  productName: string;
  deckIds: string[];
  assetCount: number;
  updatedAt: string;
  status: OfflineDeckDownloadState;
  revision: string;
  requiredAssetCount: number;
  missingRequiredCount: number;
  lastVerifiedAt: string | null;
  decks: OfflineDeckManifest[];
  storageEstimate?: OfflineStorageEstimate | null;
}

export interface OfflinePresentationSummary {
  downloadedProducts: number;
  downloadedDecks: number;
  cachedAssets: number;
  incompleteDecks: number;
  corruptedDecks: number;
  needsUpdateDecks: number;
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
  decks: DeckAssetPlan[];
  requiredUrls: string[];
  revision: string;
  knownBytes: number;
}

interface DeckAssetPlan {
  deckId: string;
  title: string;
  mediaUrls: string[];
  presentationUrls: string[];
  htmlUrls: string[];
  requiredUrls: string[];
  optionalUrls: string[];
  knownBytes: number;
  revision: string;
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

function sumKnownBytes(values: unknown[]) {
  return values.reduce((total, value) => {
    const next = Number(value);
    return Number.isFinite(next) && next > 0 ? total + next : total;
  }, 0);
}

function hashString(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return `rev-${hash.toString(16)}`;
}

function normalizeOfflinePresentationRecord(
  record: OfflinePresentationRecord | null | undefined
): OfflinePresentationRecord | null {
  if (!record) {
    return null;
  }

  return {
    productId: record.productId,
    productName: record.productName,
    deckIds: Array.isArray(record.deckIds) ? record.deckIds : [],
    assetCount: Number(record.assetCount) || 0,
    updatedAt: String(record.updatedAt || new Date(0).toISOString()),
    status: record.status || "downloaded",
    revision: String(record.revision || ""),
    requiredAssetCount: Number(record.requiredAssetCount) || 0,
    missingRequiredCount: Number(record.missingRequiredCount) || 0,
    lastVerifiedAt: record.lastVerifiedAt || null,
    storageEstimate: record.storageEstimate || null,
    decks: Array.isArray(record.decks)
      ? record.decks.map((deck) => ({
          deckId: deck.deckId,
          title: deck.title,
          revision: deck.revision || "",
          requiredUrls: Array.isArray(deck.requiredUrls) ? deck.requiredUrls : [],
          optionalUrls: Array.isArray(deck.optionalUrls) ? deck.optionalUrls : [],
          requiredAssetCount: Number(deck.requiredAssetCount) || 0,
          missingRequiredUrls: Array.isArray(deck.missingRequiredUrls) ? deck.missingRequiredUrls : [],
          status: deck.status || "downloaded",
          lastVerifiedAt: deck.lastVerifiedAt || null,
        }))
      : [],
  };
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
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([productId, value]) => {
        const normalized = normalizeOfflinePresentationRecord(value as OfflinePresentationRecord);
        return normalized ? [[productId, normalized]] : [];
      })
    );
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
  const decks: DeckAssetPlan[] = [];
  const knownByteValues: number[] = [];

  if (product.thumbnail) {
    mediaUrls.push(product.thumbnail);
  }

  const groups = Array.isArray(product.media) ? product.media : [];
  for (const group of groups) {
    const deckId = String(group?.groupId || `deck-${decks.length + 1}`);
    deckIds.add(deckId);
    const deckMediaUrls: string[] = [];
    const deckPresentationUrls: string[] = [];
    const deckHtmlUrls: string[] = [];
    const optionalUrls: string[] = [];
    const deckByteValues: number[] = [];

    const items = Array.isArray(group.items) ? group.items : [];
    for (const item of items) {
      if (item.thumbnailUrl) {
        const cacheName = classifyCacheName(item.thumbnailUrl);
        (cacheName === MEDIA_CACHE_NAME ? mediaUrls : presentationUrls).push(item.thumbnailUrl);
        optionalUrls.push(item.thumbnailUrl);
      }

      if (!item.url) {
        continue;
      }

      if (item.type === "html") {
        htmlUrls.push(item.url);
        deckHtmlUrls.push(item.url);
        deckByteValues.push(sumKnownBytes([item.size, item.fileSize, item.bytes]));
        continue;
      }

      const cacheName =
        item.type === "image" && !isUploadsUrl(item.url)
          ? MEDIA_CACHE_NAME
          : classifyCacheName(item.url);

      (cacheName === MEDIA_CACHE_NAME ? mediaUrls : presentationUrls).push(item.url);
      (cacheName === MEDIA_CACHE_NAME ? deckMediaUrls : deckPresentationUrls).push(item.url);
      deckByteValues.push(sumKnownBytes([item.size, item.fileSize, item.bytes]));
    }

    const deckRequiredUrls = uniqueUrls([...deckMediaUrls, ...deckPresentationUrls, ...deckHtmlUrls]);
    const deckRevision = hashString(JSON.stringify([deckId, deckRequiredUrls, optionalUrls]));
    const knownBytes = deckByteValues.reduce((total, value) => total + value, 0);
    knownByteValues.push(knownBytes);
    decks.push({
      deckId,
      title: String(group?.title || deckId),
      mediaUrls: uniqueUrls(deckMediaUrls),
      presentationUrls: uniqueUrls(deckPresentationUrls),
      htmlUrls: uniqueUrls(deckHtmlUrls),
      requiredUrls: deckRequiredUrls,
      optionalUrls: uniqueUrls(optionalUrls),
      knownBytes,
      revision: deckRevision,
    });
  }

  const requiredUrls = uniqueUrls([
    ...mediaUrls,
    ...presentationUrls,
    ...htmlUrls,
  ]);
  const revision = hashString(JSON.stringify([product._id || product.id || product.name, requiredUrls, decks.map((deck) => deck.revision)]));

  return {
    deckIds: Array.from(deckIds),
    productName: product.name || product._id || "Presentation",
    mediaUrls: uniqueUrls(mediaUrls),
    presentationUrls: uniqueUrls(presentationUrls),
    htmlUrls: uniqueUrls(htmlUrls),
    decks,
    requiredUrls,
    revision,
    knownBytes: knownByteValues.reduce((total, value) => total + value, 0),
  };
}

async function getCachedUrlSet() {
  if (!isBrowser() || !("caches" in window)) {
    return new Set<string>();
  }

  const cacheNames = [MEDIA_CACHE_NAME, PRESENTATION_CACHE_NAME];
  const entries = await Promise.all(
    cacheNames.map(async (cacheName) => {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      return keys.map((request) => request.url);
    })
  );

  return new Set(entries.flat());
}

function deriveRecordStatus(deckStatuses: OfflineDeckDownloadState[]) {
  if (deckStatuses.some((status) => status === "corrupted")) {
    return "corrupted" as const;
  }
  if (deckStatuses.some((status) => status === "needs_update")) {
    return "needs_update" as const;
  }
  if (deckStatuses.some((status) => status === "incomplete" || status === "downloading")) {
    return "incomplete" as const;
  }
  if (deckStatuses.every((status) => status === "downloaded")) {
    return "downloaded" as const;
  }
  return "not_downloaded" as const;
}

function buildDeckManifestFromPlan(
  plan: DeckAssetPlan,
  dependencies: string[],
  cachedUrlSet: Set<string>,
  existingDeck?: OfflineDeckManifest | null
): OfflineDeckManifest {
  const requiredUrls = uniqueUrls([...plan.requiredUrls, ...dependencies]);
  const missingRequiredUrls = requiredUrls.filter((url) => !cachedUrlSet.has(url));
  const revisionChanged = !!existingDeck && existingDeck.revision && existingDeck.revision !== plan.revision;
  const status: OfflineDeckDownloadState = revisionChanged
    ? "needs_update"
    : missingRequiredUrls.length === 0
    ? "downloaded"
    : existingDeck?.status === "downloaded"
    ? "corrupted"
    : "incomplete";

  return {
    deckId: plan.deckId,
    title: plan.title,
    revision: plan.revision,
    requiredUrls,
    optionalUrls: uniqueUrls(plan.optionalUrls),
    requiredAssetCount: requiredUrls.length,
    missingRequiredUrls,
    status,
    lastVerifiedAt: new Date().toISOString(),
  };
}

export async function getStorageEstimateSnapshot(): Promise<OfflineStorageEstimate | null> {
  if (!isBrowser() || !navigator.storage?.estimate) {
    return null;
  }

  try {
    const [{ quota, usage }, persisted] = await Promise.all([
      navigator.storage.estimate(),
      navigator.storage.persisted ? navigator.storage.persisted().catch(() => false) : Promise.resolve(null),
    ]);
    const safeQuota = typeof quota === "number" ? quota : null;
    const safeUsage = typeof usage === "number" ? usage : null;
    const available =
      safeQuota !== null && safeUsage !== null
        ? Math.max(safeQuota - safeUsage, 0)
        : null;

    return {
      quota: safeQuota,
      usage: safeUsage,
      available,
      headroomRatio: available !== null && safeQuota ? available / safeQuota : null,
      persisted: typeof persisted === "boolean" ? persisted : null,
    };
  } catch {
    return null;
  }
}

export async function estimateOfflineDownloadNeed(product: Product) {
  const plan = buildProductAssetPlan(product);
  const storage = await getStorageEstimateSnapshot();
  const suggestedRequiredBytes = Math.max(plan.knownBytes, STORAGE_HEADROOM_MIN_BYTES);
  const available = storage?.available ?? null;
  const lowHeadroom =
    available !== null &&
    (available < suggestedRequiredBytes || (storage?.headroomRatio ?? 1) < 0.1);

  return {
    productId: product._id || product.id || product.name,
    requiredAssetCount: plan.requiredUrls.length,
    knownBytes: plan.knownBytes,
    suggestedRequiredBytes,
    lowHeadroom,
    storage,
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

async function verifyCachedProductPlan(
  product: Product,
  htmlDependenciesByDeck: Record<string, string[]> = {}
) {
  const plan = buildProductAssetPlan(product);
  const cachedUrlSet = await getCachedUrlSet();
  const existingRecord = getOfflinePresentationRecord(product._id || product.id || product.name);
  const decks = plan.decks.map((deckPlan) =>
    buildDeckManifestFromPlan(
      deckPlan,
      htmlDependenciesByDeck[deckPlan.deckId] || [],
      cachedUrlSet,
      existingRecord?.decks.find((deck) => deck.deckId === deckPlan.deckId) || null
    )
  );
  const status = deriveRecordStatus(decks.map((deck) => deck.status));
  const missingRequiredCount = decks.reduce((total, deck) => total + deck.missingRequiredUrls.length, 0);
  const cachedAssets = plan.requiredUrls.filter((url) => cachedUrlSet.has(url)).length;
  const storageEstimate = await getStorageEstimateSnapshot();

  const record: OfflinePresentationRecord = {
    productId: product._id || product.id || product.name,
    productName: plan.productName,
    deckIds: plan.deckIds,
    assetCount: cachedAssets,
    updatedAt: new Date().toISOString(),
    status,
    revision: plan.revision,
    requiredAssetCount: decks.reduce((total, deck) => total + deck.requiredAssetCount, 0),
    missingRequiredCount,
    lastVerifiedAt: new Date().toISOString(),
    decks,
    storageEstimate,
  };

  saveOfflinePresentationRecord(record);
  return record;
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
  const htmlDependenciesByDeck: Record<string, string[]> = {};
  let cached = 0;
  let failed = 0;

  saveOfflinePresentationRecord({
    productId: product._id || product.id || product.name,
    productName: plan.productName,
    deckIds: plan.deckIds,
    assetCount: 0,
    updatedAt: new Date().toISOString(),
    status: "downloading",
    revision: plan.revision,
    requiredAssetCount: plan.requiredUrls.length,
    missingRequiredCount: plan.requiredUrls.length,
    lastVerifiedAt: null,
    decks: plan.decks.map((deck) => ({
      deckId: deck.deckId,
      title: deck.title,
      revision: deck.revision,
      requiredUrls: deck.requiredUrls,
      optionalUrls: deck.optionalUrls,
      requiredAssetCount: deck.requiredUrls.length,
      missingRequiredUrls: deck.requiredUrls,
      status: "downloading",
      lastVerifiedAt: null,
    })),
    storageEstimate: await getStorageEstimateSnapshot(),
  });

  for (const htmlUrl of plan.htmlUrls) {
    const result = await cacheHtmlDocumentAndDependencies(htmlUrl);
    cached += result.cached;
    failed += result.failed;
    htmlDependencies.push(...result.dependencies);
    const deck = plan.decks.find((candidate) => candidate.htmlUrls.includes(htmlUrl));
    if (deck) {
      htmlDependenciesByDeck[deck.deckId] = uniqueUrls([
        ...(htmlDependenciesByDeck[deck.deckId] || []),
        ...result.dependencies,
      ]);
    }
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

  const verifiedRecord = await verifyCachedProductPlan(product, htmlDependenciesByDeck);

  return {
    attempted:
      plan.mediaUrls.length +
      plan.presentationUrls.length +
      plan.htmlUrls.length +
      uniqueUrls(htmlDependencies).length,
    cached: verifiedRecord.assetCount,
    failed,
    status: verifiedRecord.status,
    storageEstimate: verifiedRecord.storageEstimate || null,
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
  return normalizeOfflinePresentationRecord(records[productId] || null);
}

export async function verifyOfflinePresentation(product: Product) {
  return verifyCachedProductPlan(product);
}

export function getOfflinePresentationSummary(): OfflinePresentationSummary {
  const records = Object.values(readOfflinePresentationMap()).sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  );

  return {
    downloadedProducts: records.filter((record) => record.status === "downloaded").length,
    downloadedDecks: records.reduce(
      (total, record) => total + record.decks.filter((deck) => deck.status === "downloaded").length,
      0
    ),
    cachedAssets: records.reduce((total, record) => total + record.assetCount, 0),
    incompleteDecks: records.reduce(
      (total, record) => total + record.decks.filter((deck) => deck.status === "incomplete").length,
      0
    ),
    corruptedDecks: records.reduce(
      (total, record) => total + record.decks.filter((deck) => deck.status === "corrupted").length,
      0
    ),
    needsUpdateDecks: records.reduce(
      (total, record) => total + record.decks.filter((deck) => deck.status === "needs_update").length,
      0
    ),
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

export async function repairOfflinePresentation(product: Product) {
  return cacheProductForOffline(product);
}
