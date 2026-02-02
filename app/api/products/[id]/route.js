import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { requireAuth } from "@/lib/auth";
import path from "path";
import { promises as fs } from "fs";
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

const getIdFromRequest = (request, params) => {
  if (params?.id) return params.id;
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
};

const getConvertedFolderFromUrl = (url) => {
  const marker = "/uploads/converted/";
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const rest = url.slice(index + marker.length);
  const folder = rest.split("/")[0];
  return folder || null;
};

export async function PUT(request, { params }) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const id = getIdFromRequest(request, params);
    if (!id) {
      return NextResponse.json({ error: "Product id is required." }, { status: 400 });
    }

    await connectDB();
    const existing = await Product.findById(id);
    if (!existing) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    // Check content type to determine if it's JSON or FormData
    const contentType = request.headers.get("content-type") || "";
    let payload;
    let newMediaFiles = [];

    if (contentType.includes("multipart/form-data")) {
      // Handle FormData with file uploads
      const formData = await request.formData();
      
      // Extract regular fields
      payload = {
        name: formData.get("name") || existing.name,
        brandName: formData.get("brandName") || existing.brandName,
        category: formData.get("category") || existing.category,
        description: formData.get("description") || existing.description,
        thumbnailUrl: formData.get("thumbnailUrl") || existing.thumbnailUrl,
        media: existing.media || []
      };

      // Handle new media files
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
            newMediaFiles.push({
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
            newMediaFiles.push({ type: getMediaType(mimeType || filename), url: publicUrl });
          }
        }
      }

      // Merge new media with existing
      payload.media = [...payload.media, ...newMediaFiles];
    } else {
      // Handle JSON payload
      payload = await request.json();
    }

    const nextMedia = Array.isArray(payload.media) ? payload.media : existing.media;
    const existingUrls = new Set((existing.media || []).map((item) => item.url));
    const nextUrls = new Set((nextMedia || []).map((item) => item.url));
    const removedUrls = Array.from(existingUrls).filter((url) => !nextUrls.has(url));
    const remainingUrls = Array.from(nextUrls);

    for (const url of removedUrls) {
      if (typeof url !== "string") continue;
      if (!url.startsWith("/uploads/")) continue;
      const filePath = path.join(process.cwd(), "public", url);
      try {
        await fs.unlink(filePath);
      } catch {
        // ignore missing files
      }
    }

    const removedConvertedFolders = new Set(
      removedUrls
        .map((url) => (typeof url === "string" ? getConvertedFolderFromUrl(url) : null))
        .filter(Boolean)
    );
    const remainingConvertedFolders = new Set(
      remainingUrls
        .map((url) => (typeof url === "string" ? getConvertedFolderFromUrl(url) : null))
        .filter(Boolean)
    );

    for (const folder of removedConvertedFolders) {
      if (remainingConvertedFolders.has(folder)) continue;
      const folderPath = path.join(convertedDir, folder);
      try {
        await fs.rm(folderPath, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }

    const updated = await Product.findByIdAndUpdate(id, payload, { new: true });
    if (!updated) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update product error:", error);
    return NextResponse.json({ error: "Failed to update product." }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const id = getIdFromRequest(request, params);
    if (!id) {
      return NextResponse.json({ error: "Product id is required." }, { status: 400 });
    }

    await connectDB();
    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const mediaItems = Array.isArray(deleted.media) ? deleted.media : [];
    const mediaUrls = mediaItems.map((item) => item?.url).filter(Boolean);
    const convertedFolders = new Set();

    for (const url of mediaUrls) {
      if (typeof url !== "string") continue;
      const folder = getConvertedFolderFromUrl(url);
      if (folder) {
        convertedFolders.add(folder);
        continue;
      }
      if (!url.startsWith("/uploads/")) continue;
      const filePath = path.join(process.cwd(), "public", url);
      try {
        await fs.unlink(filePath);
      } catch {
        // ignore missing files
      }
    }

    for (const folder of convertedFolders) {
      const folderPath = path.join(convertedDir, folder);
      try {
        await fs.rm(folderPath, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete product error:", error);
    return NextResponse.json({ error: "Failed to delete product." }, { status: 500 });
  }
}
