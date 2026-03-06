import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { requireApiAuthIfEnabled } from "@/lib/apiAccess";
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
  if (lower.includes("text/html") || lower.match(/\.(html|htm)$/)) return "html";
  return "image";
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

const getIdFromRequest = async (request, params) => {
  const resolvedParams = await params;
  if (resolvedParams?.id) return resolvedParams.id;
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  return parts[parts.length - 2] || "";
};

export async function POST(request, { params }) {
  try {
    const auth = await requireApiAuthIfEnabled(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const id = await getIdFromRequest(request, params);
    if (!id) {
      return NextResponse.json({ error: "Product id is required." }, { status: 400 });
    }

    const formData = await request.formData();
    const requestedGroupId = String(formData.get("groupId") || "").trim();
    const requestedSourceName = String(formData.get("sourceName") || "").trim();
    const mediaFiles = formData.getAll("mediaFile");
    if (!mediaFiles.length) {
      return NextResponse.json({ error: "No media files provided." }, { status: 400 });
    }

    const batchGroupId = requestedGroupId || makeGroupId("manual");
    const uploadFolder = sanitizePathToken(batchGroupId, "manual_upload");
    const batchUploadDir = path.join(convertedDir, uploadFolder);
    const additions = [];
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
          const groupId = makeGroupId(safeName);
          const queuedFilename = `${groupId}${ext}`;
          const filePath = path.join(queueDir, queuedFilename);
          await fs.writeFile(filePath, buffer);
          const publicUrl = `/uploads/queue/${queuedFilename}`;
          additions.push({
            type: "pdf",
            url: publicUrl,
            status: "pending",
            groupId,
            sourceName: filename,
          });
        } else {
          // Regular file upload (images, videos, etc.)
          await fs.mkdir(batchUploadDir, { recursive: true });
          const newFilename = await resolveUniqueFilename(batchUploadDir, filename);
          const filePath = path.join(batchUploadDir, newFilename);
          await fs.writeFile(filePath, buffer);
          const publicUrl = `/uploads/converted/${uploadFolder}/${newFilename}`;
          additions.push({
            type: getMediaType(mimeType || filename),
            url: publicUrl,
            groupId: batchGroupId,
            sourceName: requestedSourceName || "Manual upload",
          });
        }
      }
    }

    await connectDB();
    const product = await Product.findByIdAndUpdate(
      id,
      { $push: { media: { $each: additions } } },
      { new: true }
    );

    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("Update product media error:", error);
    return NextResponse.json({ error: "Failed to update product media." }, { status: 500 });
  }
}
