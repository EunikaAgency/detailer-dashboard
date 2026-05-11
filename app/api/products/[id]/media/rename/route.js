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

const cleanFilename = (name) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

const sanitizePathToken = (value = "", fallback = "image") => {
  const cleaned = cleanFilename(String(value || "").slice(0, 120));
  if (!cleaned || /^\.+$/.test(cleaned)) return fallback;
  return cleaned;
};

const toPublicFilePath = (url = "") => {
  const clean = cleanUrl(url);
  if (!clean.startsWith("/uploads/")) return null;
  const relative = clean.replace(/^\/+/, "");
  return path.join(publicDir, relative);
};

const toUploadPublicUrl = (absolutePath) => {
  const relativeToPublic = path.relative(publicDir, absolutePath);
  if (!relativeToPublic || relativeToPublic.startsWith("..")) return "";
  return `/${relativeToPublic.split(path.sep).join("/")}`;
};

const isPathInsideUploads = (targetPath) => {
  if (!targetPath) return false;
  const normalizedTarget = path.normalize(targetPath);
  const normalizedRoot = path.normalize(uploadsDir + path.sep);
  return normalizedTarget.startsWith(normalizedRoot);
};

const buildRenamedFilename = (currentFilename = "", requestedName = "") => {
  const rawCurrent = String(currentFilename || "").trim() || "image";
  const rawRequested = String(requestedName || "").trim();
  const currentExt = path.extname(rawCurrent);
  const currentBase = path.basename(rawCurrent, currentExt);
  const requestedExt = path.extname(rawRequested);
  const requestedBase = path.basename(rawRequested, requestedExt);
  const safeBase = sanitizePathToken(requestedBase, currentBase || "image");
  return `${safeBase}${currentExt}`;
};

const rewriteHotspots = (hotspots = [], oldUrl = "", newUrl = "") => {
  if (!Array.isArray(hotspots)) return [];
  return hotspots.map((hotspot) => ({
    ...hotspot,
    targetPageId:
      cleanUrl(hotspot?.targetPageId || "") === oldUrl ? newUrl : hotspot?.targetPageId || "",
  }));
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
    const newName = String(formData.get("newName") || "").trim();

    if (!oldUrl) {
      return NextResponse.json({ error: "Old media URL is required." }, { status: 400 });
    }
    if (!newName) {
      return NextResponse.json({ error: "New filename is required." }, { status: 400 });
    }

    await connectDB();
    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const mediaItems = Array.isArray(product.media) ? [...product.media] : [];
    const mediaIndex = mediaItems.findIndex((item) => cleanUrl(item?.url) === oldUrl);
    if (mediaIndex === -1) {
      return NextResponse.json({ error: "Media item not found." }, { status: 404 });
    }

    const mediaItem = mediaItems[mediaIndex];
    const oldPath = toPublicFilePath(mediaItem.url);
    if (!oldPath || !isPathInsideUploads(oldPath)) {
      return NextResponse.json(
        { error: "Rename is only supported for files under /uploads." },
        { status: 400 }
      );
    }

    const currentFilename = path.basename(oldPath);
    const nextFilename = buildRenamedFilename(currentFilename, newName);
    const nextPath = path.join(path.dirname(oldPath), nextFilename);
    const nextUrl = toUploadPublicUrl(nextPath);

    if (!nextUrl) {
      return NextResponse.json({ error: "Failed to build renamed media URL." }, { status: 500 });
    }

    if (nextPath !== oldPath) {
      try {
        await fs.access(nextPath);
        return NextResponse.json(
          { error: "A file with that name already exists in this media group." },
          { status: 409 }
        );
      } catch {
        // target filename is available
      }

      await fs.rename(oldPath, nextPath);
    }

    product.media = mediaItems.map((item) => {
      const cleanItemUrl = cleanUrl(item?.url || "");
      const cleanThumbnailUrl = cleanUrl(item?.thumbnailUrl || "");
      const nextItemUrl = cleanItemUrl === oldUrl ? nextUrl : cleanItemUrl;
      const nextThumbnailUrl = cleanThumbnailUrl === oldUrl ? nextUrl : cleanThumbnailUrl;
      return {
        ...item.toObject(),
        url: nextItemUrl,
        thumbnailUrl: nextThumbnailUrl,
        title:
          cleanItemUrl === oldUrl &&
          (!item?.title || String(item?.title || "").trim() === currentFilename)
            ? nextFilename
            : item?.title,
        hotspots: rewriteHotspots(item?.hotspots, oldUrl, nextUrl),
      };
    });

    product.markModified("media");
    product.updatedAt = new Date();
    await product.save();

    return NextResponse.json(product);
  } catch (error) {
    console.error("Rename product media error:", error);
    return NextResponse.json(
      {
        error: "Failed to rename media image.",
        details: error?.message || "unknown",
      },
      { status: 500 }
    );
  }
}
