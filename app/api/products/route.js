import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { requireAuth } from "@/lib/auth";
import { isPdf, isPpt } from "@/lib/fileConverter";
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
  return "image";
};

const cleanFilename = (name) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

const normalizeKey = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

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
    const auth = await requireAuth(request);
    const apiKeyAllowed = hasValidApiKey(request);
    if (auth.error && !apiKeyAllowed) {
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
    const version = Math.floor(Date.now() / 3600000) * 3600000;
    return NextResponse.json({ version, products: enriched });
  } catch (error) {
    console.error("Fetch products error:", error);
    return NextResponse.json({ error: "Failed to fetch products." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const formData = await request.formData();
    const name = String(formData.get("name") || "").trim();
    const brandName = String(formData.get("brandName") || "").trim();
    const category = String(formData.get("category") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const thumbnailUrl = String(formData.get("thumbnailUrl") || "").trim();
    const mediaUrls = String(formData.get("mediaUrls") || "").trim();

    if (!name || !category || !description) {
      return NextResponse.json(
        { error: "Name, category, and description are required." },
        { status: 400 }
      );
    }

    const media = [];

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
          await fs.mkdir(uploadsDir, { recursive: true });
          const ext = path.extname(filename) || ".bin";
          const safeName = cleanFilename(path.basename(filename, ext));
          const newFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}${ext}`;
          const filePath = path.join(uploadsDir, newFilename);
          await fs.writeFile(filePath, buffer);
          const publicUrl = `/uploads/${newFilename}`;
          media.push({ type: getMediaType(mimeType || filename), url: publicUrl });
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
