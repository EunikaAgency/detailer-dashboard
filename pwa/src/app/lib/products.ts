/**
 * Products data management.
 * Keeps the React UI aligned with the working app-capacitor config format.
 */

import { apiClient, type Product as ApiProduct } from "./api";
import { warmProductMediaCache } from "./media-cache";
import { resolveMediaUrl } from "./media";

const PRODUCTS_CACHE_KEY = "productsConfig";

export interface Product extends ApiProduct {
  id?: string;
  subcases?: Array<{
    id: string;
    title?: string;
    slides: any[];
  }>;
}

export interface NormalizedHotspot {
  id?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shape?: string;
  targetIndex: number;
}

export interface NormalizedSlide {
  id: string;
  type: string;
  url: string;
  thumbnailUrl?: string;
  title?: string;
  sourceUrl: string;
  hotspots?: NormalizedHotspot[];
}

const BUNDLED_PRODUCTS: Product[] = [
  {
    _id: "prod-001",
    name: "CardioHealth Treatment Options",
    category: "Cardiology",
    thumbnail: "https://images.unsplash.com/photo-1758691463610-3c2ecf5fb3fa?w=400",
    media: [
      {
        groupId: "cardio-standard-protocol",
        title: "Standard Treatment Protocol",
        items: [
          {
            id: "slide-1",
            type: "image",
            url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1080",
            thumbnailUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=200",
            title: "Introduction",
          },
        ],
      },
    ],
  },
];

function normalizeConfigPayload(raw: unknown): { version: number; products: Product[] } {
  if (!raw) return { version: 0, products: [] };
  if (Array.isArray(raw)) return { version: Number((raw as any).version) || 0, products: raw as Product[] };
  if (Array.isArray((raw as any).products)) {
    return {
      version: Number((raw as any).version) || 0,
      products: (raw as any).products as Product[],
    };
  }
  return { version: 0, products: [] };
}

function pickFirstString(...values: unknown[]) {
  for (const value of values) {
    const next = String(value || "").trim();
    if (next) return next;
  }
  return "";
}

function normalizeSlideUrl(url: string): string {
  return String(url || "")
    .replace(/^https?:\/\//, "")
    .replace(/^[^/]+/, "")
    .split("?")[0]
    .split("#")[0]
    .trim();
}

function normalizeSlideItem(item: any, index: number) {
  const url = resolveMediaUrl(
    pickFirstString(item?.url, item?.src, item?.path, item?.image, item?.imageUrl, item?.fileUrl)
  );
  const thumbnailUrl = resolveMediaUrl(
    pickFirstString(item?.thumbnailUrl, item?.thumbnail, item?.thumb, item?.previewUrl, url)
  );
  const type = pickFirstString(item?.type, item?.kind, item?.mediaType).toLowerCase() || "image";
  return {
    ...item,
    id: pickFirstString(item?.id, item?._id, `${type}-${index + 1}`),
    type,
    url,
    thumbnailUrl: thumbnailUrl || undefined,
    title: pickFirstString(item?.title, item?.caption, item?.name) || undefined,
  };
}

function normalizeMediaGroups(product: Product) {
  const explicitGroups = Array.isArray(product.media) ? product.media : [];
  if (explicitGroups.length > 0) {
    return explicitGroups.map((group, groupIndex) => ({
      ...group,
      groupId: pickFirstString(group?.groupId, group?.id, `group-${groupIndex + 1}`),
      title: pickFirstString(group?.title, group?.name, group?.groupId, `Case ${groupIndex + 1}`),
      items: Array.isArray(group?.items)
        ? group.items.map((item: any, itemIndex: number) => normalizeSlideItem(item, itemIndex))
        : [],
    }));
  }

  const subcases = Array.isArray(product.subcases) ? product.subcases : [];
  return subcases.map((subcase, groupIndex) => ({
    groupId: pickFirstString(subcase?.id, subcase?.title, `group-${groupIndex + 1}`),
    title: pickFirstString(subcase?.title, subcase?.id, `Case ${groupIndex + 1}`),
    items: Array.isArray(subcase?.slides)
      ? subcase.slides.map((item: any, itemIndex: number) => normalizeSlideItem(item, itemIndex))
      : [],
  }));
}

function normalizeProduct(product: Product, index: number): Product {
  const normalizedMedia = normalizeMediaGroups(product);
  return {
    ...product,
    _id: pickFirstString(product?._id, product?.id, product?.name, `product-${index + 1}`),
    category: pickFirstString(
      product?.category,
      Array.isArray((product as any)?.categories) ? (product as any).categories[0] : "",
      "General"
    ),
    thumbnail: resolveMediaUrl(
      pickFirstString(product?.thumbnail, (product as any)?.thumbnailUrl, normalizedMedia[0]?.items?.[0]?.thumbnailUrl)
    ),
    media: normalizedMedia,
  };
}

function normalizeProducts(products: Product[]) {
  return products.map((product, index) => normalizeProduct(product, index));
}

function normalizeHotspots(hotspots: any[] | undefined, slides: any[]): NormalizedHotspot[] {
  if (!Array.isArray(hotspots) || hotspots.length === 0) return [];

  const urlToIndexMap = new Map<string, number>();
  slides.forEach((slide, index) => {
    const normalizedUrl = normalizeSlideUrl(slide.url || slide.src || "");
    urlToIndexMap.set(normalizedUrl, index);
  });

  return hotspots
    .map((hotspot) => {
      const normalizedTarget = normalizeSlideUrl(hotspot?.targetPageId || hotspot?.target || "");
      const targetIndex = urlToIndexMap.get(normalizedTarget);
      if (targetIndex === undefined) return null;
      return {
        id: hotspot.id,
        x: Number(hotspot.x) || 0,
        y: Number(hotspot.y) || 0,
        w: Number(hotspot.w) || 0,
        h: Number(hotspot.h) || 0,
        shape: hotspot.shape || "rect",
        targetIndex,
      };
    })
    .filter((hotspot): hotspot is NormalizedHotspot => hotspot !== null);
}

export function normalizeSlides(items: any[]): NormalizedSlide[] {
  const normalizedItems = (Array.isArray(items) ? items : []).map((item, index) => normalizeSlideItem(item, index));
  return normalizedItems.map((slide, index) => ({
    id: slide.id,
    type: slide.type,
    url: slide.url,
    thumbnailUrl: slide.thumbnailUrl,
    title: slide.title,
    sourceUrl: normalizeSlideUrl(slide.url),
    hotspots: normalizeHotspots((Array.isArray(items) ? items[index]?.hotspots : undefined) || slide.hotspots, normalizedItems) || undefined,
  }));
}

export function getCachedProducts(): Product[] | null {
  try {
    const cached = localStorage.getItem(PRODUCTS_CACHE_KEY);
    if (!cached) return null;
    const data = normalizeConfigPayload(JSON.parse(cached));
    return normalizeProducts(data.products);
  } catch {
    return null;
  }
}

export function getBundledProducts(): Product[] {
  return normalizeProducts(BUNDLED_PRODUCTS);
}

export function getLocallyAvailableProducts(): Product[] {
  return getCachedProducts() || getBundledProducts();
}

export async function getProducts(): Promise<{ products: Product[]; source: "live" | "cached" | "bundled" }> {
  try {
    const response = normalizeConfigPayload(await apiClient.getProducts());
    const products = normalizeProducts(response.products);
    localStorage.setItem(
      PRODUCTS_CACHE_KEY,
      JSON.stringify({
        version: response.version,
        products,
        timestamp: new Date().toISOString(),
      })
    );
    void warmProductMediaCache(products);
    return { products, source: "live" };
  } catch {
    const cached = getCachedProducts();
    if (cached?.length) {
      return { products: cached, source: "cached" };
    }
    return { products: getBundledProducts(), source: "bundled" };
  }
}

export function getProductById(id: string, products: Product[]): Product | null {
  return products.find((product) => product._id === id || product.id === id) || null;
}

function cleanDeckLabel(raw: string) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";

  return trimmed
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/^\d{10,}-\d+-/i, "")
    .replace(/\be[-_\s]*detailer\b/gi, "ONE DETAILER")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getDeckTitle(deck: any, fallbackIndex = 0) {
  const explicitTitle = pickFirstString(deck?.title, deck?.name);
  if (explicitTitle && !/^\d{10,}-\d+-/i.test(explicitTitle)) {
    return cleanDeckLabel(explicitTitle) || explicitTitle;
  }

  const firstItem = Array.isArray(deck?.items)
    ? deck.items[0]
    : Array.isArray(deck?.slides)
      ? deck.slides[0]
      : null;

  const derivedTitle = cleanDeckLabel(
    pickFirstString(firstItem?.sourceName, firstItem?.title, deck?.groupId, deck?.id)
  );

  return (derivedTitle || `Case ${fallbackIndex + 1}`).toUpperCase();
}

export async function resolveProductById(id: string) {
  const localProduct = getProductById(id, getLocallyAvailableProducts());
  const localHasRenderableSlides = localProduct
    ? getProductDecks(localProduct).some((deck) => getRenderableSlides(deck.items || deck.slides || []).length > 0)
    : false;

  if (localProduct && localHasRenderableSlides) {
    return localProduct;
  }

  const result = await getProducts();
  return getProductById(id, result.products) || localProduct;
}

export function extractCategories(products: Product[]) {
  const categories = new Set<string>();
  products.forEach((product) => {
    if (product.category) categories.add(product.category);
  });
  return Array.from(categories).sort();
}

export function getCategories(products: Product[]) {
  return extractCategories(products);
}

export function getProductDecks(product: Product) {
  return normalizeMediaGroups(product);
}

export function getRenderableSlides(input: any[] | { items?: any[]; slides?: any[] }) {
  const items = Array.isArray(input)
    ? input
    : Array.isArray((input as any)?.items)
      ? (input as any).items
      : Array.isArray((input as any)?.slides)
        ? (input as any).slides
        : [];
  return normalizeSlides(items).filter((item) => ["image", "video", "html"].includes(item.type));
}

export function estimateDuration(slideCount: number) {
  const minutes = Math.ceil((slideCount * 30) / 60);
  if (minutes < 1) return "< 1 min";
  if (minutes === 1) return "1 min";
  return `${minutes} mins`;
}

export function clearProductsCache() {
  localStorage.removeItem(PRODUCTS_CACHE_KEY);
}
