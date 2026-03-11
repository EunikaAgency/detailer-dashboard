import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

const publicDir = path.join(process.cwd(), "public");
const uploadsDir = path.join(publicDir, "uploads");

const getIdFromRequest = async (request, params) => {
  const resolvedParams = await params;
  if (resolvedParams?.id) return resolvedParams.id;
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const productsIndex = parts.indexOf("products");
  if (productsIndex !== -1 && parts[productsIndex + 1]) return parts[productsIndex + 1];
  return "";
};

const cleanUrl = (value = "") => String(value || "").split("#")[0].split("?")[0].trim();

const isImageFile = (filename = "", mimeType = "") => {
  const lower = `${mimeType} ${filename}`.toLowerCase();
  return lower.includes("image") || lower.match(/\.(png|jpg|jpeg|gif|webp)$/);
};

const cleanFilename = (name) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

const sanitizePathToken = (value = "", fallback = "file") => {
  const cleaned = cleanFilename(String(value || "").slice(0, 120));
  if (!cleaned || /^\.+$/.test(cleaned)) return fallback;
  return cleaned;
};

const toSafeUploadFilename = (originalName = "thumbnail") => {
  const rawName = String(originalName || "thumbnail").trim() || "thumbnail";
  const rawExt = path.extname(rawName);
  const safeBase = sanitizePathToken(path.basename(rawName, rawExt), "thumbnail");
  const safeExtToken = sanitizePathToken(rawExt, "png");
  const safeExt = safeExtToken.startsWith(".") ? safeExtToken : `.${safeExtToken}`;
  return `${safeBase}${safeExt}`;
};

const resolveUniqueFilename = async (targetDir, originalName = "thumbnail") => {
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

const toPublicFilePath = (url = "") => {
  const clean = cleanUrl(url);
  if (!clean.startsWith("/uploads/")) return null;
  const relative = clean.replace(/^\/+/, "");
  return path.join(publicDir, relative);
};

const isPathInsideUploads = (targetPath) => {
  if (!targetPath) return false;
  const normalizedTarget = path.normalize(targetPath);
  const normalizedRoot = path.normalize(uploadsDir + path.sep);
  return normalizedTarget.startsWith(normalizedRoot);
};

const toUploadPublicUrl = (absolutePath) => {
  const relativeToUploads = path.relative(uploadsDir, absolutePath);
  if (!relativeToUploads || relativeToUploads.startsWith("..")) return "";
  return `/uploads/${relativeToUploads.split(path.sep).join("/")}`;
};

export async function POST(request, { params }) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const id = await getIdFromRequest(request, params);
    if (!id) {
      return NextResponse.json({ error: "Product id is required." }, { status: 400 });
    }

    const formData = await request.formData();
    const oldUrl = cleanUrl(formData.get("oldUrl"));
    const thumbnailFile = formData.get("thumbnailFile");

    if (!oldUrl) {
      return NextResponse.json({ error: "Old media URL is required." }, { status: 400 });
    }

    if (!thumbnailFile || typeof thumbnailFile !== "object" || !thumbnailFile.arrayBuffer) {
      return NextResponse.json({ error: "Thumbnail image file is required." }, { status: 400 });
    }

    const filename = thumbnailFile.name || "thumbnail.png";
    const mimeType = thumbnailFile.type || "";
    if (!isImageFile(filename, mimeType)) {
      return NextResponse.json({ error: "Thumbnail must be an image file." }, { status: 400 });
    }

    await connectDB();
    const existing = await Product.findById(id).lean();
    if (!existing) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const mediaItem = (existing.media || []).find((item) => cleanUrl(item?.url) === oldUrl);
    if (!mediaItem?.url) {
      return NextResponse.json({ error: "Media item not found." }, { status: 404 });
    }

    const mediaPath = toPublicFilePath(mediaItem.url);
    if (!mediaPath || !isPathInsideUploads(mediaPath)) {
      return NextResponse.json(
        { error: "Thumbnail is only supported for files under /uploads." },
        { status: 400 }
      );
    }

    const targetDir = path.dirname(mediaPath);
    await fs.mkdir(targetDir, { recursive: true });

    const currentThumbnailUrl = cleanUrl(mediaItem.thumbnailUrl || "");
    const currentThumbnailPath = toPublicFilePath(currentThumbnailUrl);
    const canReuseCurrentPath =
      currentThumbnailPath &&
      isPathInsideUploads(currentThumbnailPath) &&
      path.dirname(currentThumbnailPath) === targetDir;

    let nextThumbnailPath = "";
    let nextThumbnailUrl = "";
    if (canReuseCurrentPath) {
      nextThumbnailPath = currentThumbnailPath;
      nextThumbnailUrl = currentThumbnailUrl;
    } else {
      const mediaExt = path.extname(mediaPath);
      const mediaBase = path.basename(mediaPath, mediaExt);
      const imageExt = path.extname(filename) || ".png";
      const preferredName = `${mediaBase}.thumbnail${imageExt}`;
      const nextFilename = await resolveUniqueFilename(targetDir, preferredName);
      nextThumbnailPath = path.join(targetDir, nextFilename);
      nextThumbnailUrl = toUploadPublicUrl(nextThumbnailPath);
    }

    const buffer = Buffer.from(await thumbnailFile.arrayBuffer());
    await fs.writeFile(nextThumbnailPath, buffer);

    await Product.updateOne(
      { _id: id, "media.url": mediaItem.url },
      {
        $set: {
          "media.$.thumbnailUrl": nextThumbnailUrl,
        },
      }
    );

    if (
      currentThumbnailUrl &&
      currentThumbnailUrl !== nextThumbnailUrl &&
      currentThumbnailPath &&
      isPathInsideUploads(currentThumbnailPath)
    ) {
      try {
        await fs.unlink(currentThumbnailPath);
      } catch {
        // Ignore missing file cleanup errors
      }
    }

    const product = await Product.findById(id);
    return NextResponse.json(product);
  } catch (error) {
    console.error("Set media thumbnail error:", error);
    return NextResponse.json(
      {
        error: "Failed to set media thumbnail.",
        details: error?.message || "unknown",
      },
      { status: 500 }
    );
  }
}
