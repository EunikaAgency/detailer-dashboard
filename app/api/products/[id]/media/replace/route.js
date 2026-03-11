import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

const uploadsDir = path.join(process.cwd(), "public", "uploads");

const getIdFromRequest = async (request, params) => {
  const resolvedParams = await params;
  if (resolvedParams?.id) return resolvedParams.id;
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const productsIndex = parts.indexOf("products");
  if (productsIndex !== -1 && parts[productsIndex + 1]) return parts[productsIndex + 1];
  return "";
};

const isImageFile = (filename = "", mimeType = "") => {
  const lower = `${mimeType} ${filename}`.toLowerCase();
  return lower.includes("image") || lower.match(/\.(png|jpg|jpeg|gif|webp)$/);
};

const toPublicFilePath = (url = "") => {
  const clean = String(url || "").split("#")[0].split("?")[0];
  if (!clean.startsWith("/uploads/")) return null;
  const relative = clean.replace(/^\/+/, "");
  return path.join(process.cwd(), "public", relative);
};

const isPathInsideUploads = (targetPath) => {
  if (!targetPath) return false;
  const normalizedTarget = path.normalize(targetPath);
  const normalizedRoot = path.normalize(uploadsDir + path.sep);
  return normalizedTarget.startsWith(normalizedRoot);
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
    const oldUrl = String(formData.get("oldUrl") || "").trim();
    const mediaFile = formData.get("mediaFile");

    if (!oldUrl) {
      return NextResponse.json({ error: "Old media URL is required." }, { status: 400 });
    }

    if (!mediaFile || typeof mediaFile !== "object" || !mediaFile.arrayBuffer) {
      return NextResponse.json({ error: "Replacement image file is required." }, { status: 400 });
    }

    const filename = mediaFile.name || "replacement";
    const mimeType = mediaFile.type || "";
    if (!isImageFile(filename, mimeType)) {
      return NextResponse.json({ error: "Replacement must be an image file." }, { status: 400 });
    }

    const buffer = Buffer.from(await mediaFile.arrayBuffer());
    await connectDB();
    const existing = await Product.findOne({ _id: id, "media.url": oldUrl }).lean();
    if (!existing) {
      return NextResponse.json({ error: "Media item not found." }, { status: 404 });
    }

    const oldPath = toPublicFilePath(oldUrl);
    const canOverwriteOldFile = oldPath && isPathInsideUploads(oldPath);
    if (!canOverwriteOldFile) {
      return NextResponse.json(
        { error: "Replacement is only supported for files under /uploads." },
        { status: 400 }
      );
    }

    const publicUrl = oldUrl;
    await fs.mkdir(path.dirname(oldPath), { recursive: true });
    await fs.writeFile(oldPath, buffer);

    await Product.updateOne(
      { _id: id, "media.url": oldUrl },
      {
        $set: {
          "media.$.url": publicUrl,
          "media.$.type": "image",
          "media.$.size": buffer.length,
        },
      }
    );

    const product = await Product.findById(id);

    const newPath = toPublicFilePath(publicUrl);
    if (oldPath && newPath && oldPath !== newPath) {
      try {
        await fs.unlink(oldPath);
      } catch {
        // Ignore missing file cleanup errors
      }
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("Replace product media error:", error);
    return NextResponse.json(
      {
        error: "Failed to replace media image.",
        details: error?.message || "unknown",
      },
      { status: 500 }
    );
  }
}
