import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { requireApiAuthIfEnabled } from "@/lib/apiAccess";
import { isPdf, isPpt } from "@/lib/fileConverter";
import { applyProductImageLibrary } from "@/lib/productImageLibrary";
import "@/lib/conversionWorker";

export const runtime = "nodejs";

const uploadsDir = path.join(process.cwd(), "public", "uploads");
const queueDir = path.join(uploadsDir, "queue");
const convertedDir = path.join(uploadsDir, "converted");

const getMediaType = (value) => {
  const lower = value.toLowerCase();
  if (lower.includes("video") || lower.match(/\.(mp4|mov|webm|avi)$/)) return "video";
  if (lower.includes("pdf") || lower.endsWith(".pdf")) return "pdf";
  if (lower.match(/\.(png|jpg|jpeg|gif|webp)$/)) return "image";
  if (lower.includes("text/html") || lower.match(/\.(html|htm)$/)) return "html";
  return "image";
};

const isImageFile = (filename = "", mimeType = "") => {
  const lower = `${mimeType} ${filename}`.toLowerCase();
  return lower.includes("image") || lower.match(/\.(png|jpg|jpeg|gif|webp)$/);
};

const cleanFilename = (name) => name.replace(/[^a-zA-Z0-9._-]/g, "_");
const makeGroupId = (seed = "media") =>
  `${Date.now()}-${Math.round(Math.random() * 1e9)}-${cleanFilename(seed).slice(0, 80) || "media"}`;
const sanitizePathToken = (value = "", fallback = "media") => {
  const cleaned = cleanFilename(String(value || "").slice(0, 120));
  if (!cleaned || /^\.+$/.test(cleaned)) return fallback;
  return cleaned;
};
const toSafeUploadFilename = (originalName = "upload") => {
  const rawName = String(originalName || "upload").trim() || "upload";
  const rawExt = path.extname(rawName);
  const safeBase = sanitizePathToken(path.basename(rawName, rawExt), "upload");
  const safeExtToken = sanitizePathToken(rawExt, "bin");
  const safeExt = safeExtToken.startsWith(".") ? safeExtToken : `.${safeExtToken}`;
  return `${safeBase}${safeExt}`;
};
const resolveUniqueFilename = async (targetDir, originalName = "upload") => {
  const safeName = toSafeUploadFilename(originalName);
  const ext = path.extname(safeName);
  const base = path.basename(safeName, ext);
  for (let index = 0; index < 1000; index += 1) {
    const suffix = index === 0 ? "" : `-${index + 1}`;
    const candidate = `${base}${suffix}${ext}`;
    try {
      await fs.access(path.join(targetDir, candidate));
    } catch {
      return candidate;
    }
  }
  return `${base}-${Date.now()}${ext}`;
};

const normalizeKey = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const getUrlWithoutQuery = (value = "") =>
  String(value || "").split("#")[0].split("?")[0];

const withQueryParam = (url = "", key, value) => {
  const hasQuery = url.includes("?");
  return `${url}${hasQuery ? "&" : "?"}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
};

const toPublicFilePath = (url = "") => {
  const clean = getUrlWithoutQuery(url);
  if (!clean.startsWith("/uploads/")) return null;
  return path.join(process.cwd(), "public", clean);
};

const applyCacheBustToProductPayload = async (products = []) => {
  const versionByUrl = new Map();

  const resolveUrl = async (url) => {
    const clean = getUrlWithoutQuery(url);
    if (!clean.startsWith("/uploads/")) return url;

    if (versionByUrl.has(clean)) {
      const version = versionByUrl.get(clean);
      return version ? withQueryParam(clean, "v", version) : clean;
    }

    const filePath = toPublicFilePath(clean);
    if (!filePath) {
      versionByUrl.set(clean, null);
      return clean;
    }

    try {
      const stat = await fs.stat(filePath);
      const version = Math.floor(stat.mtimeMs);
      versionByUrl.set(clean, version);
      return withQueryParam(clean, "v", version);
    } catch {
      versionByUrl.set(clean, null);
      return clean;
    }
  };

  const applyToMedia = async (media = []) => {
    if (!Array.isArray(media)) return media;
    if (media[0] && Array.isArray(media[0].items)) {
      return Promise.all(
        media.map(async (group) => ({
          ...group,
          items: await Promise.all(
            (group.items || []).map(async (item) => ({
              ...item,
              url: await resolveUrl(item?.url || ""),
              thumbnailUrl: await resolveUrl(item?.thumbnailUrl || ""),
            }))
          ),
        }))
      );
    }

    return Promise.all(
      media.map(async (item) => ({
        ...item,
        url: await resolveUrl(item?.url || ""),
        thumbnailUrl: await resolveUrl(item?.thumbnailUrl || ""),
      }))
    );
  };

  return Promise.all(
    products.map(async (product) => ({
      ...product,
      thumbnailUrl: await resolveUrl(product?.thumbnailUrl || ""),
      media: await applyToMedia(product?.media || []),
    }))
  );
};

const getPageNumberFromFilename = (filename = "") => {
  const value = String(filename || "");
  const namedMatch = value.match(/(?:^|[._\-\s])(page|slide)[._\-\s]?(\d+)(?=\.[^.]+$|$)/i);
  if (namedMatch) {
    const parsed = Number.parseInt(namedMatch[2], 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  const trailingMatch = value.match(/(\d+)(?=\.[^.]+$|$)/);
  if (!trailingMatch) return null;
  const parsed = Number.parseInt(trailingMatch[1], 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const sortConvertedFilenames = (left, right) => {
  const leftPage = getPageNumberFromFilename(left);
  const rightPage = getPageNumberFromFilename(right);

  if (leftPage !== null && rightPage !== null && leftPage !== rightPage) {
    return leftPage - rightPage;
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

const buildConvertedIndex = async () => {
  try {
    const folders = await fs.readdir(convertedDir, { withFileTypes: true });
    const entries = [];
    for (const entry of folders) {
      if (!entry.isDirectory()) continue;
      const folder = entry.name;
      const imagesDir = path.join(convertedDir, folder, "images");
      let images = [];
      try {
        const files = await fs.readdir(imagesDir);
        images = files
          .filter((name) => name.match(/\.(png|jpg|jpeg|webp|gif)$/i))
          .sort(sortConvertedFilenames)
          .map((name) => `/uploads/converted/${folder}/images/${name}`);
      } catch {
        images = [];
      }
      if (images.length) {
        entries.push({ folder, normalized: normalizeKey(folder), images });
      }
    }
    return entries;
  } catch {
    return [];
  }
};

const attachConvertedMedia = (product, convertedIndex) => {
  const nameKey = normalizeKey(product?.name);
  if (!nameKey) return product;

  const existing = Array.isArray(product.media) ? product.media : [];
  const existingUrls = new Set(existing.map((item) => item?.url).filter(Boolean));

  const matchedImages = convertedIndex
    .filter((entry) => entry.normalized.includes(nameKey))
    .flatMap((entry) =>
      entry.images.map((url) => ({
        type: "image",
        url,
        groupId: entry.folder,
        sourceName: product?.name || "",
      }))
    )
    .filter((item) => !existingUrls.has(item.url));

  if (!matchedImages.length) return product;
  return { ...product, media: [...existing, ...matchedImages] };
};

const CONVERTED_PREFIX = "/uploads/converted/";

const getConvertedFolderFromUrl = (url) => {
  const value = typeof url === "string" ? url : "";
  const index = value.indexOf(CONVERTED_PREFIX);
  if (index === -1) return "";
  const rest = value.slice(index + CONVERTED_PREFIX.length);
  return rest.split("/")[0] || "";
};

const buildMediaGroupsFromMedia = (media = []) => {
  if (!Array.isArray(media) || media.length === 0) return [];
  const groups = new Map();

  media.forEach((item) => {
    const url = item?.url;
    if (!url) return;
    const folder = item?.groupId || getConvertedFolderFromUrl(url);
    if (!folder) return;
    const entry = groups.get(folder) || [];
    entry.push({
      url,
      thumbnailUrl: item?.thumbnailUrl,
      type: item?.type,
      title: item?.title,
      size: item?.size,
      status: item?.status,
      groupId: item?.groupId,
      sourceName: item?.sourceName,
      hotspots: Array.isArray(item?.hotspots) ? item.hotspots : [],
    });
    groups.set(folder, entry);
  });

  return Array.from(groups.entries()).map(([groupId, items]) => ({
    groupId,
    items,
  }));
};

const hasValidApiKey = (request) => {
  const configuredApiKey = String(process.env.API_KEY || "").trim();
  if (!configuredApiKey || !request) return false;

  const headerApiKey =
    request.headers.get("x-api-key") ||
    request.headers.get("api-key") ||
    request.headers.get("authorization")?.replace(/^ApiKey\s+/i, "");

  const queryApiKey = new URL(request.url).searchParams.get("api_key");
  const providedApiKey = String(headerApiKey || queryApiKey || "").trim();
  return providedApiKey && providedApiKey === configuredApiKey;
};

export async function GET(request) {
  try {
    const auth = await requireApiAuthIfEnabled(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await connectDB();
    const convertedIndex = await buildConvertedIndex();
    const products = await Product.find().sort({ createdAt: -1 }).lean();
    const enriched = convertedIndex.length
      ? products.map((product) => {
          const withMedia = attachConvertedMedia(product, convertedIndex);
          const mediaGroups = buildMediaGroupsFromMedia(withMedia.media);
          return { ...withMedia, media: mediaGroups };
        })
      : products.map((product) => ({
          ...product,
          media: buildMediaGroupsFromMedia(product.media),
        }));
    const rewrittenProducts = await applyProductImageLibrary(enriched);
    const apiKeyAllowed = hasValidApiKey(request);
    const responseProducts = !auth.user && apiKeyAllowed
      ? await applyCacheBustToProductPayload(rewrittenProducts)
      : rewrittenProducts;
    const version = Math.floor(Date.now() / 3600000) * 3600000;
    return NextResponse.json({ version, products: responseProducts });
  } catch (error) {
    console.error("Fetch products error:", error);
    return NextResponse.json({ error: "Failed to fetch products." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await requireApiAuthIfEnabled(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const formData = await request.formData();
    const name = String(formData.get("name") || "").trim();
    const brandName = String(formData.get("brandName") || "").trim();
    const category = String(formData.get("category") || "").trim();
    const description = String(formData.get("description") || "").trim();
    let thumbnailUrl = String(formData.get("thumbnailUrl") || "").trim();
    const mediaUrls = String(formData.get("mediaUrls") || "").trim();
    const thumbnailFile = formData.get("thumbnailFile");

    if (!name || !category || !description) {
      return NextResponse.json(
        { error: "Name, category, and description are required." },
        { status: 400 }
      );
    }

    const media = [];

    if (thumbnailFile && typeof thumbnailFile === "object" && thumbnailFile.arrayBuffer) {
      const buffer = Buffer.from(await thumbnailFile.arrayBuffer());
      const filename = thumbnailFile.name || "thumbnail";
      const mimeType = thumbnailFile.type || "";
      if (!isImageFile(filename, mimeType)) {
        return NextResponse.json(
          { error: "Thumbnail must be an image file." },
          { status: 400 }
        );
      }
      await fs.mkdir(uploadsDir, { recursive: true });
      const ext = path.extname(filename) || ".bin";
      const safeName = cleanFilename(path.basename(filename, ext));
      const newFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}${ext}`;
      const filePath = path.join(uploadsDir, newFilename);
      await fs.writeFile(filePath, buffer);
      thumbnailUrl = `/uploads/${newFilename}`;
    }

    if (mediaUrls) {
      mediaUrls
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean)
        .forEach((url) => {
          media.push({ type: getMediaType(url), url });
        });
    }

    const mediaFiles = formData.getAll("mediaFile");
    const uploadGroupId = makeGroupId(name || "manual");
    const uploadFolder = sanitizePathToken(uploadGroupId, "manual_upload");
    const groupedUploadDir = path.join(convertedDir, uploadFolder);
    for (const mediaFile of mediaFiles) {
      if (mediaFile && typeof mediaFile === "object" && mediaFile.arrayBuffer) {
        const buffer = Buffer.from(await mediaFile.arrayBuffer());
        const filename = mediaFile.name || "upload";
        const mimeType = mediaFile.type || "";

        // Check if file is PDF or PPT/PPTX
        if (isPdf(filename, mimeType) || isPpt(filename, mimeType)) {
          await fs.mkdir(queueDir, { recursive: true });
          const ext = path.extname(filename) || ".bin";
          const safeName = cleanFilename(path.basename(filename, ext));
          const groupId = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`;
          const queuedFilename = `${groupId}${ext}`;
          const filePath = path.join(queueDir, queuedFilename);
          await fs.writeFile(filePath, buffer);
          const publicUrl = `/uploads/queue/${queuedFilename}`;
          media.push({
            type: "pdf",
            url: publicUrl,
            status: "pending",
            groupId,
            sourceName: filename,
          });
        } else {
          // Regular file upload (images, videos, etc.)
          await fs.mkdir(groupedUploadDir, { recursive: true });
          const newFilename = await resolveUniqueFilename(groupedUploadDir, filename);
          const filePath = path.join(groupedUploadDir, newFilename);
          await fs.writeFile(filePath, buffer);
          const publicUrl = `/uploads/converted/${uploadFolder}/${newFilename}`;
          media.push({
            type: getMediaType(mimeType || filename),
            url: publicUrl,
            groupId: uploadGroupId,
            sourceName: "Manual upload",
          });
        }
      }
    }

    await connectDB();
    const product = await Product.create({
      name,
      brandName,
      category,
      description,
      thumbnailUrl,
      media,
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Create product error:", error);
    return NextResponse.json({ 
      error: "Failed to create product.", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
