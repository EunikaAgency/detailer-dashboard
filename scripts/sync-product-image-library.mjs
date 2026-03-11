#!/usr/bin/env node

import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const PRODUCTS_ENDPOINT = process.env.PRODUCTS_ENDPOINT || "https://otsukadetailer.site/api/products";
const OUTPUT_ROOT = path.join(process.cwd(), "public", "uploads", "product-library");
const JPEG_QUALITY = Number(process.env.PRODUCT_IMAGE_JPEG_QUALITY || "82");
const MAX_WIDTH = Number(process.env.PRODUCT_IMAGE_MAX_WIDTH || "1920");
const MAX_HEIGHT = Number(process.env.PRODUCT_IMAGE_MAX_HEIGHT || "1920");

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff", ".avif", ".heic", ".heif"]);

const cleanUrl = (value = "") => String(value || "").split("#")[0].split("?")[0].trim();

const slugify = (value = "") =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/(^|[\s_-])\d{10,}(?=$|[\s_-])/g, " ")
    .replace(/(^|[\s_-])\d{6,}(?=$|[\s_-])/g, " ")
    .replace(/[_\s.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const pad = (value, width = 3) => String(value).padStart(width, "0");

const isImageUrl = (value = "") => {
  const ext = path.extname(cleanUrl(value)).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
};

const getPageNumber = (value = "", fallback = 1) => {
  const clean = cleanUrl(value);
  const named = clean.match(/(?:page|slide)[._\-\s]?(\d+)/i);
  if (named) return Number(named[1]);
  const trailing = clean.match(/(\d+)(?=\.[^.]+$|$)/);
  if (trailing) return Number(trailing[1]);
  return fallback;
};

const inferPresentationSlug = (productSlug, group, item, groupIndex) => {
  const source = item?.sourceName || group?.title || group?.name || group?.groupId || `presentation-${groupIndex + 1}`;
  const candidate = slugify(source) || `presentation-${groupIndex + 1}`;
  if (candidate === productSlug) return `${candidate}-slides`;
  return candidate;
};

const resolveSourceUrl = (assetUrl) => new URL(cleanUrl(assetUrl), PRODUCTS_ENDPOINT).toString();

const ensureDir = async (targetPath) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
};

const uniqueRelativePath = (relativePath, usedPaths) => {
  if (!usedPaths.has(relativePath)) {
    usedPaths.add(relativePath);
    return relativePath;
  }

  const ext = path.extname(relativePath);
  const base = relativePath.slice(0, -ext.length);
  let counter = 2;
  while (true) {
    const next = `${base}-${counter}${ext}`;
    if (!usedPaths.has(next)) {
      usedPaths.add(next);
      return next;
    }
    counter += 1;
  }
};

const downloadToTemp = async (assetUrl) => {
  const response = await fetch(resolveSourceUrl(assetUrl));
  if (!response.ok) {
    throw new Error(`Failed to download ${assetUrl}: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`Expected image for ${assetUrl}, received ${contentType || "unknown content-type"}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "product-library-"));
  const sourceExt = path.extname(cleanUrl(assetUrl)).toLowerCase() || ".img";
  const sourcePath = path.join(tempDir, `source${sourceExt}`);
  await fs.writeFile(sourcePath, buffer);
  return { tempDir, sourcePath };
};

const convertToJpg = async (sourcePath, destinationPath) => {
  await ensureDir(destinationPath);
  await execFileAsync("convert", [
    sourcePath,
    "-auto-orient",
    "-strip",
    "-resize",
    `${MAX_WIDTH}x${MAX_HEIGHT}>`,
    "-background",
    "white",
    "-alpha",
    "remove",
    "-alpha",
    "off",
    "-sampling-factor",
    "4:2:0",
    "-interlace",
    "Plane",
    "-quality",
    String(JPEG_QUALITY),
    destinationPath,
  ]);

  try {
    await execFileAsync("jpegoptim", [
      "--strip-all",
      "--all-progressive",
      `--max=${JPEG_QUALITY}`,
      destinationPath,
    ]);
  } catch {
    // Leave the converted file in place if jpegoptim is unavailable or fails.
  }
};

const buildAssetPlan = (products = []) => {
  const usedPaths = new Set();
  const mappings = new Map();
  const tasks = [];

  const register = (sourceUrl, relativePath) => {
    const cleanSource = cleanUrl(sourceUrl);
    if (!cleanSource) return null;
    const existing = mappings.get(cleanSource);
    if (existing) return existing;

    const nextRelativePath = uniqueRelativePath(relativePath, usedPaths);
    const finalUrl = `/uploads/product-library/${nextRelativePath.split(path.sep).join("/")}`;
    const record = { sourceUrl: cleanSource, relativePath: nextRelativePath, finalUrl };
    mappings.set(cleanSource, record);
    tasks.push(record);
    return record;
  };

  products.forEach((product, productIndex) => {
    const productSlug = slugify(product?.name) || `product-${productIndex + 1}`;
    const mediaGroups = Array.isArray(product?.media) ? product.media : [];

    mediaGroups.forEach((group, groupIndex) => {
      const items = Array.isArray(group?.items) ? group.items : [];
      items.forEach((item, itemIndex) => {
        if (!isImageUrl(item?.url)) return;
        const presentationSlug = inferPresentationSlug(productSlug, group, item, groupIndex);
        const slideNumber = pad(getPageNumber(item?.url, itemIndex + 1));
        register(
          item.url,
          path.join(
            productSlug,
            presentationSlug,
            `${productSlug}-${presentationSlug}-slide-${slideNumber}.jpg`
          )
        );
      });
    });

    if (isImageUrl(product?.thumbnailUrl)) {
      register(product.thumbnailUrl, path.join(productSlug, `${productSlug}-product-thumbnail.jpg`));
    }

    mediaGroups.forEach((group, groupIndex) => {
      const items = Array.isArray(group?.items) ? group.items : [];
      items.forEach((item, itemIndex) => {
        if (!isImageUrl(item?.thumbnailUrl)) return;
        const presentationSlug = inferPresentationSlug(productSlug, group, item, groupIndex);
        const slideNumber = pad(getPageNumber(item?.url || item?.thumbnailUrl, itemIndex + 1));
        register(
          item.thumbnailUrl,
          path.join(
            productSlug,
            presentationSlug,
            `${productSlug}-${presentationSlug}-slide-${slideNumber}-thumbnail.jpg`
          )
        );
      });
    });
  });

  return { tasks, mappings };
};

const syncAssets = async (tasks) => {
  for (const [index, task] of tasks.entries()) {
    const destinationPath = path.join(OUTPUT_ROOT, task.relativePath);
    const { tempDir, sourcePath } = await downloadToTemp(task.sourceUrl);
    try {
      await convertToJpg(sourcePath, destinationPath);
      process.stdout.write(`Processed ${index + 1}/${tasks.length}: ${task.relativePath}\n`);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
};

const writeManifest = async (products, mappings) => {
  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceEndpoint: PRODUCTS_ENDPOINT,
    folder: "/uploads/product-library",
    productCount: products.length,
    assetCount: mappings.size,
    mappings: Object.fromEntries(
      Array.from(mappings.entries()).map(([sourceUrl, record]) => [sourceUrl, record.finalUrl])
    ),
  };

  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  await fs.writeFile(path.join(OUTPUT_ROOT, "manifest.json"), JSON.stringify(manifest, null, 2));
};

const main = async () => {
  const response = await fetch(PRODUCTS_ENDPOINT);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${PRODUCTS_ENDPOINT}: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const products = Array.isArray(payload?.products) ? payload.products : [];
  if (!products.length) {
    throw new Error("The products payload did not contain any products.");
  }

  const { tasks, mappings } = buildAssetPlan(products);
  await fs.rm(OUTPUT_ROOT, { recursive: true, force: true });
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  await syncAssets(tasks);
  await writeManifest(products, mappings);

  process.stdout.write(
    `Synced ${tasks.length} images for ${products.length} products into ${OUTPUT_ROOT}\n`
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
